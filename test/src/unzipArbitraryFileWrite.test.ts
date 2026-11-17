import * as node_fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "vitest";
import * as yazl from "yazl";
import * as zl from "../../src";
import * as fs from "../../src/fs";
import { expectNamedError } from "./helpers";

describe("unzip, safeSymlinksOnly=false", () => {
    it("extract a zip file that attempt to write file outside output folder, case 1, safeSymlinksOnly=false", async () => {
        await expectNamedError(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_file_write.zip"),
                    path.join(__dirname, "../unzips/arbitrary_file_write"),
                    {
                        overwrite: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AFWRITE",
            "extract a zip file that attempt to write file outside output folder, case 1, safeSymlinksOnly=false",
        );
    });

    it("extract a zip file that attempt to write file outside output folder, case 2, safeSymlinksOnly=false", async () => {
        await expectNamedError(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_file_write2.zip"),
                    path.join(__dirname, "../unzips/arbitrary_file_write2"),
                    {
                        overwrite: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AFWRITE",
            "extract a zip file that attempt to write file outside output folder, case 2, safeSymlinksOnly=false",
        );
    });

    it("extract a zip file that attempt to write file to symlink folder which is outside output folder, safeSymlinksOnly=false", async () => {
        await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/output"));
        await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
        await fs.ensureFolder(path.join(__dirname, "../unzips/arbitrary_write/tmp"));

        await zl.extract(
            path.join(__dirname, "../unzipResources/arbitrary_write/output1.zip"),
            path.join(__dirname, "../unzips/arbitrary_write/output"),
            {
                overwrite: false,
                symlinkAsFileOnWindows: false,
            },
        );

        await expectNamedError(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_write/output2.zip"),
                    path.join(__dirname, "../unzips/arbitrary_write/output"),
                    {
                        overwrite: false,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AFWRITE",
            "extract a zip file that attempt to write file to symlink folder which is outside output folder, safeSymlinksOnly=false",
        );

        await expectNamedError(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_write/output3.zip"),
                    path.join(__dirname, "../unzips/arbitrary_write/output"),
                    {
                        overwrite: false,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AFWRITE",
            "extract a zip file that attempt to write file to symlink folder which is outside output folder, safeSymlinksOnly=false",
        );
    });

    it("rejects writing a regular-file entry through a same-named symlink entry, safeSymlinksOnly=false", async () => {
        const SYMLINK_MODE = 0o120000 | 0o0777;
        const REGULAR_MODE = 0o100644;
        const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
        const outside = path.join(sandbox, "outside.txt");
        node_fs.writeFileSync(outside, "ORIGINAL");
        const zipPath = path.join(sandbox, "evil.zip");
        const extract = path.join(sandbox, "extract");
        // ... craft zip with symlink + regular entry, both named "pwn" ...
        await new Promise<void>((resolve, reject) => {
            const zf = new yazl.ZipFile();
            zf.addBuffer(Buffer.from(outside), "pwn", { mode: SYMLINK_MODE }); // (1) symlink → target
            zf.addBuffer(Buffer.from("PWNED\n"), "pwn", { mode: REGULAR_MODE }); // (2) regular file, same path
            zf.end();
            zf.outputStream.pipe(node_fs.createWriteStream(zipPath)).on("close", resolve).on("error", reject);
        });
        await expectNamedError(
            () =>
                zl.extract(zipPath, extract, {
                    overwrite: true,
                    symlinkAsFileOnWindows: false,
                }),
            "AFWRITE",
            "rejects writing a regular-file entry through a same-named symlink entry, safeSymlinksOnly=false",
        );
    });

    if (process.platform !== "win32") {
        it("rejects writing a regular-file entry through a chain of relative symlink entries, safeSymlinksOnly=false", async () => {
            const SYMLINK_MODE = 0o120000 | 0o0777;
            const REGULAR_MODE = 0o100644;
            const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
            const outside = path.join(sandbox, "outside");
            node_fs.mkdirSync(outside);
            const relOutside = path.relative("/", outside);
            const zipPath = path.join(sandbox, "evil.zip");
            const extract = path.join(sandbox, "extract");
            // Every link target is inside the extraction folder when ".." is collapsed as text,
            // but the kernel resolves "l/.." after following the link, so each link goes one level up.
            // 16 levels are more than the extraction folder is deep, above "/" the kernel stays at "/".
            const levels = 16;
            const entries: { name: string; data: string; mode: number }[] = [
                { name: `${relOutside}/marker.txt`, data: "decoy", mode: REGULAR_MODE },
                { name: "l", data: ".", mode: SYMLINK_MODE },
            ];
            for (let i = 1; i <= levels; i++) {
                entries.push({ name: `x${i}`, data: i === 1 ? "l/.." : `x${i - 1}/..`, mode: SYMLINK_MODE });
            }
            entries.push({ name: `x${levels}/${relOutside}/marker.txt`, data: "PWNED\n", mode: REGULAR_MODE });
            // ... craft zip with a symlink chain + regular entry written through the last link ...
            await new Promise<void>((resolve, reject) => {
                const zf = new yazl.ZipFile();
                for (const entry of entries) {
                    zf.addBuffer(Buffer.from(entry.data), entry.name, { mode: entry.mode });
                }
                zf.end();
                zf.outputStream.pipe(node_fs.createWriteStream(zipPath)).on("close", resolve).on("error", reject);
            });
            await expectNamedError(
                () =>
                    zl.extract(zipPath, extract, {
                        overwrite: true,
                        symlinkAsFileOnWindows: false,
                    }),
                "AFWRITE",
                "rejects writing a regular-file entry through a chain of relative symlink entries, safeSymlinksOnly=false",
            );
        });
    }
});

describe("unzip, safeSymlinksOnly=true", () => {
    it("extract a zip file that attempt to write file outside output folder, case 1, safeSymlinksOnly=true", async () => {
        await expectNamedError(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_file_write.zip"),
                    path.join(__dirname, "../unzips/arbitrary_file_write"),
                    {
                        overwrite: true,
                        safeSymlinksOnly: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AF_ILLEGAL_TARGET",
            "extract a zip file that attempt to write file outside output folder, case 1, safeSymlinksOnly=true",
        );
    });

    it("extract a zip file that attempt to write file outside output folder, case 2, safeSymlinksOnly=true", async () => {
        await expectNamedError(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_file_write2.zip"),
                    path.join(__dirname, "../unzips/arbitrary_file_write2"),
                    {
                        overwrite: true,
                        safeSymlinksOnly: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AF_ILLEGAL_TARGET",
            "extract a zip file that attempt to write file outside output folder, case 2, safeSymlinksOnly=true",
        );
    });

    it("extract a zip file that attempt to write file to symlink folder which is outside output folder, safeSymlinksOnly=true", async () => {
        await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/output"));
        await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
        await fs.ensureFolder(path.join(__dirname, "../unzips/arbitrary_write/tmp"));

        await expectNamedError(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_write/output1.zip"),
                    path.join(__dirname, "../unzips/arbitrary_write/output"),
                    {
                        overwrite: false,
                        safeSymlinksOnly: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AF_ILLEGAL_TARGET",
            "extract a zip file that attempt to write file to symlink folder which is outside output folder, safeSymlinksOnly=true",
        );

        await zl.extract(
            path.join(__dirname, "../unzipResources/arbitrary_write/output2.zip"),
            path.join(__dirname, "../unzips/arbitrary_write/output"),
            {
                overwrite: false,
                safeSymlinksOnly: true,
                symlinkAsFileOnWindows: false,
            },
        );

        await expectNamedError(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_write/output3.zip"),
                    path.join(__dirname, "../unzips/arbitrary_write/output"),
                    {
                        overwrite: false,
                        safeSymlinksOnly: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AF_ILLEGAL_TARGET",
            "extract a zip file that attempt to write file to symlink folder which is outside output folder, safeSymlinksOnly=true",
        );
    });

    if (process.platform !== "win32") {
        it("rejects writing a regular-file entry through a chain of relative symlink entries, safeSymlinksOnly=true", async () => {
            const SYMLINK_MODE = 0o120000 | 0o0777;
            const REGULAR_MODE = 0o100644;
            const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
            const outside = path.join(sandbox, "outside");
            node_fs.mkdirSync(outside);
            const relOutside = path.relative("/", outside);
            const zipPath = path.join(sandbox, "evil.zip");
            const extract = path.join(sandbox, "extract");
            // Every link target is inside the extraction folder when ".." is collapsed as text,
            // but the kernel resolves "l/.." after following the link, so each link goes one level up.
            // 16 levels are more than the extraction folder is deep, above "/" the kernel stays at "/".
            const levels = 16;
            const entries: { name: string; data: string; mode: number }[] = [
                { name: `${relOutside}/marker.txt`, data: "decoy", mode: REGULAR_MODE },
                { name: "l", data: ".", mode: SYMLINK_MODE },
            ];
            for (let i = 1; i <= levels; i++) {
                entries.push({ name: `x${i}`, data: i === 1 ? "l/.." : `x${i - 1}/..`, mode: SYMLINK_MODE });
            }
            entries.push({ name: `x${levels}/${relOutside}/marker.txt`, data: "PWNED\n", mode: REGULAR_MODE });
            // ... craft zip with a symlink chain + regular entry written through the last link ...
            await new Promise<void>((resolve, reject) => {
                const zf = new yazl.ZipFile();
                for (const entry of entries) {
                    zf.addBuffer(Buffer.from(entry.data), entry.name, { mode: entry.mode });
                }
                zf.end();
                zf.outputStream.pipe(node_fs.createWriteStream(zipPath)).on("close", resolve).on("error", reject);
            });
            await expectNamedError(
                () =>
                    zl.extract(zipPath, extract, {
                        overwrite: true,
                        safeSymlinksOnly: true,
                        symlinkAsFileOnWindows: false,
                    }),
                "AF_ILLEGAL_TARGET",
                "rejects writing a regular-file entry through a chain of relative symlink entries, safeSymlinksOnly=true",
            );
        });
    }
});
