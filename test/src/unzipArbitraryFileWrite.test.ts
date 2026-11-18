import * as node_fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as yazl from "yazl";
import * as zl from "../../src";
import * as fs from "../../src/fs";
import { expectNamedError } from "./helpers";

interface IZipEntry {
    name: string;
    data: string;
    mode: number;
}

async function writeZip(zipPath: string, entries: IZipEntry[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const zf = new yazl.ZipFile();
        for (const entry of entries) {
            if (entry.name.endsWith("/")) {
                zf.addEmptyDirectory(entry.name, { mode: entry.mode });
            } else {
                zf.addBuffer(Buffer.from(entry.data), entry.name, { mode: entry.mode });
            }
        }
        zf.end();
        zf.outputStream.pipe(node_fs.createWriteStream(zipPath)).on("close", resolve).on("error", reject);
    });
}

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
        await writeZip(zipPath, [
            { name: "pwn", data: outside, mode: SYMLINK_MODE }, // (1) symlink → target
            { name: "pwn", data: "PWNED\n", mode: REGULAR_MODE }, // (2) regular file, same path
        ]);
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

    it("rejects writing a regular-file entry through a same-named dangling symlink entry, safeSymlinksOnly=false", async () => {
        const SYMLINK_MODE = 0o120000 | 0o0777;
        const REGULAR_MODE = 0o100644;
        const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
        const outside = path.join(sandbox, "escaped.txt");
        const zipPath = path.join(sandbox, "evil.zip");
        const extract = path.join(sandbox, "extract");
        try {
            // The link target does not exist, so fs.realpath cannot resolve the link path.
            await writeZip(zipPath, [
                { name: "pwn.txt", data: "../escaped.txt", mode: SYMLINK_MODE }, // (1) dangling symlink
                { name: "pwn.txt", data: "PWNED\n", mode: REGULAR_MODE }, // (2) regular file, same path
            ]);
            await expectNamedError(
                () =>
                    zl.extract(zipPath, extract, {
                        overwrite: true,
                        symlinkAsFileOnWindows: false,
                    }),
                "AFWRITE",
                "rejects writing a regular-file entry through a same-named dangling symlink entry, safeSymlinksOnly=false",
            );
            expect(node_fs.existsSync(outside)).toBe(false);
        } finally {
            node_fs.rmSync(sandbox, { recursive: true, force: true });
        }
    });

    it("rejects writing a regular-file entry through a dangling symlink left by a previous extraction, safeSymlinksOnly=false", async () => {
        const SYMLINK_MODE = 0o120000 | 0o0777;
        const REGULAR_MODE = 0o100644;
        const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
        const outside = path.join(sandbox, "escaped.txt");
        const linkZipPath = path.join(sandbox, "link.zip");
        const writeZipPath = path.join(sandbox, "write.zip");
        const extract = path.join(sandbox, "extract");
        try {
            await writeZip(linkZipPath, [{ name: "pwn.txt", data: "../escaped.txt", mode: SYMLINK_MODE }]);
            await writeZip(writeZipPath, [{ name: "pwn.txt", data: "PWNED\n", mode: REGULAR_MODE }]);
            // The dangling link survives the first extraction, the second one does not know about it.
            await zl.extract(linkZipPath, extract, { overwrite: true, symlinkAsFileOnWindows: false });
            expect(node_fs.lstatSync(path.join(extract, "pwn.txt")).isSymbolicLink()).toBe(true);
            await expectNamedError(
                () => zl.extract(writeZipPath, extract, { overwrite: false, symlinkAsFileOnWindows: false }),
                "AFWRITE",
                "rejects writing a regular-file entry through a dangling symlink left by a previous extraction, safeSymlinksOnly=false",
            );
            expect(node_fs.existsSync(outside)).toBe(false);
        } finally {
            node_fs.rmSync(sandbox, { recursive: true, force: true });
        }
    });

    it("rejects a folder entry that resolves through a dangling symlink outside output folder, safeSymlinksOnly=false", async () => {
        const SYMLINK_MODE = 0o120000 | 0o0777;
        const DIRECTORY_MODE = 0o040755 | 0o777;
        const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
        const outsideFolder = path.join(sandbox, "escaped");
        const zipPath = path.join(sandbox, "evil.zip");
        const extract = path.join(sandbox, "extract");
        try {
            await writeZip(zipPath, [
                { name: "dirlink", data: "../escaped", mode: SYMLINK_MODE },
                { name: "dirlink/", data: "", mode: DIRECTORY_MODE },
            ]);
            await expectNamedError(
                () => zl.extract(zipPath, extract, { overwrite: true, symlinkAsFileOnWindows: false }),
                "AFWRITE",
                "rejects a folder entry that resolves through a dangling symlink outside output folder, safeSymlinksOnly=false",
            );
            expect(node_fs.existsSync(outsideFolder)).toBe(false);
        } finally {
            node_fs.rmSync(sandbox, { recursive: true, force: true });
        }
    });

    it("rejects a folder entry created through a dangling symlink left by a previous extraction, safeSymlinksOnly=false", async () => {
        const SYMLINK_MODE = 0o120000 | 0o0777;
        const DIRECTORY_MODE = 0o040755 | 0o777;
        const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
        const outsideFolder = path.join(sandbox, "escaped");
        const linkZipPath = path.join(sandbox, "link.zip");
        const folderZipPath = path.join(sandbox, "folder.zip");
        const extract = path.join(sandbox, "extract");
        try {
            await writeZip(linkZipPath, [{ name: "dirlink", data: "../escaped", mode: SYMLINK_MODE }]);
            await writeZip(folderZipPath, [{ name: "dirlink/", data: "", mode: DIRECTORY_MODE }]);
            await zl.extract(linkZipPath, extract, { overwrite: true, symlinkAsFileOnWindows: false });
            expect(node_fs.lstatSync(path.join(extract, "dirlink")).isSymbolicLink()).toBe(true);
            await expectNamedError(
                () => zl.extract(folderZipPath, extract, { overwrite: false, symlinkAsFileOnWindows: false }),
                "AFWRITE",
                "rejects a folder entry created through a dangling symlink left by a previous extraction, safeSymlinksOnly=false",
            );
            expect(node_fs.existsSync(outsideFolder)).toBe(false);
        } finally {
            node_fs.rmSync(sandbox, { recursive: true, force: true });
        }
    });

    it("replaces an existing link that stays inside the target folder instead of writing through it, safeSymlinksOnly=false", async () => {
        const SYMLINK_MODE = 0o120000 | 0o0777;
        const REGULAR_MODE = 0o100644;
        const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
        const linkZipPath = path.join(sandbox, "link.zip");
        const writeZipPath = path.join(sandbox, "write.zip");
        const extract = path.join(sandbox, "extract");
        try {
            await writeZip(linkZipPath, [
                { name: "target.txt", data: "ORIGINAL", mode: REGULAR_MODE },
                { name: "pwn", data: "target.txt", mode: SYMLINK_MODE },
            ]);
            await writeZip(writeZipPath, [{ name: "pwn", data: "REPLACED", mode: REGULAR_MODE }]);
            await zl.extract(linkZipPath, extract, { overwrite: true, symlinkAsFileOnWindows: false });
            expect(node_fs.lstatSync(path.join(extract, "pwn")).isSymbolicLink()).toBe(true);
            await zl.extract(writeZipPath, extract, { overwrite: false, symlinkAsFileOnWindows: false });
            // The entry is a regular file, so it replaces the link instead of being written into
            // the link target.
            expect(node_fs.lstatSync(path.join(extract, "pwn")).isSymbolicLink()).toBe(false);
            expect(node_fs.readFileSync(path.join(extract, "pwn"), "utf8")).toBe("REPLACED");
            expect(node_fs.readFileSync(path.join(extract, "target.txt"), "utf8")).toBe("ORIGINAL");
        } finally {
            node_fs.rmSync(sandbox, { recursive: true, force: true });
        }
    });

    it("writes a file through a folder link that points inside the target folder, safeSymlinksOnly=false", async () => {
        const SYMLINK_MODE = 0o120000 | 0o0777;
        const REGULAR_MODE = 0o100644;
        const DIRECTORY_MODE = 0o040755 | 0o777;
        const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
        const zipPath = path.join(sandbox, "inside.zip");
        const extract = path.join(sandbox, "extract");
        try {
            await writeZip(zipPath, [
                { name: "sub/", data: "", mode: DIRECTORY_MODE },
                { name: "dlink", data: "sub", mode: SYMLINK_MODE },
                { name: "dlink/f.txt", data: "HELLO", mode: REGULAR_MODE },
            ]);
            await zl.extract(zipPath, extract, { overwrite: true, symlinkAsFileOnWindows: false });
            // The link is inside the target folder, so writing through it is a normal extraction.
            expect(node_fs.lstatSync(path.join(extract, "dlink")).isSymbolicLink()).toBe(true);
            expect(node_fs.readFileSync(path.join(extract, "sub", "f.txt"), "utf8")).toBe("HELLO");
        } finally {
            node_fs.rmSync(sandbox, { recursive: true, force: true });
        }
    });

    if (process.platform === "win32") {
        it("rejects writing through a reparse point that already exists in the output folder, default options", async () => {
            const REGULAR_MODE = 0o100644;
            const DIRECTORY_MODE = 0o040755 | 0o777;
            const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
            const outside = path.join(sandbox, "outside");
            node_fs.mkdirSync(outside);
            const extract = path.join(sandbox, "extract");
            node_fs.mkdirSync(path.join(extract, "node_modules"), { recursive: true });
            // A junction like the ones package managers leave in place.
            node_fs.symlinkSync(outside, path.join(extract, "node_modules", "some-pkg"), "junction");
            const fileZipPath = path.join(sandbox, "file.zip");
            const folderZipPath = path.join(sandbox, "folder.zip");
            try {
                await writeZip(fileZipPath, [
                    { name: "node_modules/some-pkg/Startup/evil.bat", data: "PWNED\n", mode: REGULAR_MODE },
                ]);
                await writeZip(folderZipPath, [
                    { name: "node_modules/some-pkg/newdir/", data: "", mode: DIRECTORY_MODE },
                ]);
                // `symlinkAsFileOnWindows` is left at its default, which used to switch the check off.
                await expectNamedError(
                    () => zl.extract(fileZipPath, extract, { overwrite: false }),
                    "AFWRITE",
                    "rejects writing through a reparse point that already exists in the output folder, default options",
                );
                await expectNamedError(
                    () => zl.extract(folderZipPath, extract, { overwrite: false }),
                    "AFWRITE",
                    "rejects creating a folder through a reparse point that already exists in the output folder, default options",
                );
                expect(node_fs.existsSync(path.join(outside, "Startup", "evil.bat"))).toBe(false);
                expect(node_fs.existsSync(path.join(outside, "newdir"))).toBe(false);
            } finally {
                node_fs.rmSync(sandbox, { recursive: true, force: true });
            }
        });
    }

    it("re-uses an existing folder symlink outside output folder for a folder entry, safeSymlinksOnly=false", async () => {
        const SYMLINK_MODE = 0o120000 | 0o0777;
        const DIRECTORY_MODE = 0o040755 | 0o777;
        const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
        const outsideFolder = path.join(sandbox, "escaped");
        node_fs.mkdirSync(outsideFolder);
        const zipPath = path.join(sandbox, "evil.zip");
        const extract = path.join(sandbox, "extract");
        try {
            await writeZip(zipPath, [
                { name: "dirlink", data: "../escaped", mode: SYMLINK_MODE },
                { name: "dirlink/", data: "", mode: DIRECTORY_MODE },
            ]);
            // The folder already exists, so the folder entry creates nothing.
            await zl.extract(zipPath, extract, { overwrite: true, symlinkAsFileOnWindows: false });
            // The link is kept as it is, and nothing is created in the folder it points to.
            expect(node_fs.lstatSync(path.join(extract, "dirlink")).isSymbolicLink()).toBe(true);
            expect(node_fs.readdirSync(outsideFolder)).toEqual([]);
        } finally {
            node_fs.rmSync(sandbox, { recursive: true, force: true });
        }
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
            const entries: IZipEntry[] = [
                { name: `${relOutside}/marker.txt`, data: "decoy", mode: REGULAR_MODE },
                { name: "l", data: ".", mode: SYMLINK_MODE },
            ];
            for (let i = 1; i <= levels; i++) {
                entries.push({ name: `x${i}`, data: i === 1 ? "l/.." : `x${i - 1}/..`, mode: SYMLINK_MODE });
            }
            entries.push({ name: `x${levels}/${relOutside}/marker.txt`, data: "PWNED\n", mode: REGULAR_MODE });
            // ... craft zip with a symlink chain + regular entry written through the last link ...
            await writeZip(zipPath, entries);
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
            const entries: IZipEntry[] = [
                { name: `${relOutside}/marker.txt`, data: "decoy", mode: REGULAR_MODE },
                { name: "l", data: ".", mode: SYMLINK_MODE },
            ];
            for (let i = 1; i <= levels; i++) {
                entries.push({ name: `x${i}`, data: i === 1 ? "l/.." : `x${i - 1}/..`, mode: SYMLINK_MODE });
            }
            entries.push({ name: `x${levels}/${relOutside}/marker.txt`, data: "PWNED\n", mode: REGULAR_MODE });
            // ... craft zip with a symlink chain + regular entry written through the last link ...
            await writeZip(zipPath, entries);
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

        it("rejects a link whose target resolves outside through a link left by a previous extraction, safeSymlinksOnly=true", async () => {
            const SYMLINK_MODE = 0o120000 | 0o0777;
            const sandbox = node_fs.mkdtempSync(path.join(node_fs.realpathSync(os.tmpdir()), "zl-"));
            const outside = path.join(sandbox, "outside");
            node_fs.mkdirSync(outside);
            const linkZipPath = path.join(sandbox, "link.zip");
            const zipPath = path.join(sandbox, "evil.zip");
            const extract = path.join(sandbox, "extract");
            try {
                // The previous extraction leaves "sub/link" pointing outside the target folder.
                await writeZip(linkZipPath, [{ name: "sub/link", data: outside, mode: SYMLINK_MODE }]);
                await zl.extract(linkZipPath, extract, { overwrite: true, symlinkAsFileOnWindows: false });
                // "sub/link/.." is inside when ".." is collapsed as text, but the kernel follows
                // the link first, so the target goes one level up from the link target.
                await writeZip(zipPath, [{ name: "x", data: "sub/link/..", mode: SYMLINK_MODE }]);
                await expectNamedError(
                    () =>
                        zl.extract(zipPath, extract, {
                            overwrite: false,
                            safeSymlinksOnly: true,
                            symlinkAsFileOnWindows: false,
                        }),
                    "AF_ILLEGAL_TARGET",
                    "rejects a link whose target resolves outside through a link left by a previous extraction, safeSymlinksOnly=true",
                );
                expect(node_fs.existsSync(path.join(extract, "x"))).toBe(false);
            } finally {
                node_fs.rmSync(sandbox, { recursive: true, force: true });
            }
        });
    }
});
