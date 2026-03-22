import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";
import { allowWindowsSymlinkPermissionError, warnWindowsSymlinkPermission } from "./helpers";

describe("zip", () => {
    it("zip symlink (followSymlinks = false)", async () => {
        const source1 = path.join(__dirname, "../resources/symlink");
        const source2 = path.join(__dirname, "../resources/subfolder_symlink");
        if (process.platform === "win32") {
            if (!fsSync.existsSync(source1) || !fsSync.existsSync(source2)) {
                warnWindowsSymlinkPermission();
                return;
            }
            if (!fsSync.lstatSync(source1).isSymbolicLink() || !fsSync.lstatSync(source2).isSymbolicLink()) {
                warnWindowsSymlinkPermission();
                return;
            }
        }
        const zipFile = path.join(__dirname, "../zips/resources_allow_symlink.zip");
        const des = path.join(__dirname, "../unzips/resources_allow_symlink");
        await zl.archiveFolder(path.join(__dirname, "../resources"), zipFile);
        const skipped = await allowWindowsSymlinkPermissionError(async () => {
            await zl.extract(zipFile, des, {
                overwrite: true,
                symlinkAsFileOnWindows: false,
            });
        });
        if (skipped) {
            return;
        }

        const stat1 = await fs.lstat(path.join(des, "symlink"));
        const stat2 = await fs.lstat(path.join(des, "subfolder_symlink"));
        expect(stat1.isSymbolicLink(), `${path.join(des, "symlink")} is not a symlink`).toBe(true);
        expect(stat2.isSymbolicLink(), `${path.join(des, "subfolder_symlink")} is not a symlink`).toBe(true);
    });

    it("zip symlink (followSymlinks = true)", async () => {
        const source1 = path.join(__dirname, "../resources/symlink");
        const source2 = path.join(__dirname, "../resources/subfolder_symlink");
        if (process.platform === "win32") {
            if (!fsSync.existsSync(source1) || !fsSync.existsSync(source2)) {
                warnWindowsSymlinkPermission();
                return;
            }
            if (!fsSync.lstatSync(source1).isSymbolicLink() || !fsSync.lstatSync(source2).isSymbolicLink()) {
                warnWindowsSymlinkPermission();
                return;
            }
        }
        const zipFile = path.join(__dirname, "../zips/resources_disallow_symlink.zip");
        const des = path.join(__dirname, "../unzips/resources_disallow_symlink");
        await zl.archiveFolder(path.join(__dirname, "../resources"), zipFile, {
            followSymlinks: true,
        });

        await zl.extract(zipFile, des, {
            overwrite: true,
        });
        const stat1 = await fs.lstat(path.join(des, "symlink"));
        const stat2 = await fs.lstat(path.join(des, "subfolder_symlink"));
        expect(stat1.isSymbolicLink(), `${path.join(des, "symlink")} is a symlink`).toBe(false);
        expect(stat2.isSymbolicLink(), `${path.join(des, "subfolder_symlink")} is a symlink`).toBe(false);
    });
});
