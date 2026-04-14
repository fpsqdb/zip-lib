import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";
import { existsSync } from "node:fs";

describe("zip", () => {
    it("zip symlink (followSymlinks = false)", async () => {
        const zipFile = path.join(__dirname, "../zips/resources_allow_symlink.zip");
        const des = path.join(__dirname, "../unzips/resources_allow_symlink");
        await zl.archiveFolder(path.join(__dirname, "../resources"), zipFile);
        await zl.extract(zipFile, des, {
            overwrite: true,
            symlinkAsFileOnWindows: false,
        });

        const stat1 = await fs.lstat(path.join(des, "symlink"));
        const stat2 = await fs.lstat(path.join(des, "subfolder_symlink"));
        expect(stat1.isSymbolicLink(), `${path.join(des, "symlink")} is not a symlink`).toBe(true);
        expect(stat2.isSymbolicLink(), `${path.join(des, "subfolder_symlink")} is not a symlink`).toBe(true);
    });

    it("zip broken symlink (followSymlinks = false)", async () => {
        const zipFile = path.join(__dirname, "../zips/resources_allow_broken_symlink.zip");
        const des = path.join(__dirname, "../unzips/resources_allow_broken_symlink");
        await zl.archiveFolder(path.join(__dirname, "../resources_with_broken_symlink"), zipFile);
        await zl.extract(zipFile, des, {
            overwrite: true,
            symlinkAsFileOnWindows: false,
        });

        const stat1 = await fs.lstat(path.join(des, "broken_file_symlink"));
        const stat2 = await fs.lstat(path.join(des, "broken_folder_symlink"));
        const stat3 = await fs.lstat(path.join(des, "broken_folder_symlink2"));
        expect(stat1.isSymbolicLink(), `${path.join(des, "broken_file_symlink")} is not a symlink`).toBe(true);
        expect(stat2.isSymbolicLink(), `${path.join(des, "broken_folder_symlink")} is not a symlink`).toBe(true);
        expect(stat3.isSymbolicLink(), `${path.join(des, "broken_folder_symlink2")} is not a symlink`).toBe(true);
    });

    it("zip symlink (followSymlinks = true)", async () => {
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

    it("zip broken symlink (followSymlinks = true)", async () => {
        const zipFile = path.join(__dirname, "../zips/resources_disallow_broken_symlink.zip");
        const des = path.join(__dirname, "../unzips/resources_disallow_broken_symlink");
        await zl.archiveFolder(path.join(__dirname, "../resources_with_broken_symlink"), zipFile, {
            followSymlinks: true,
        });
        await zl.extract(zipFile, des, {
            overwrite: true,
        });
        expect(existsSync(path.join(des, "test.txt"))).toBe(true);
        expect(existsSync(path.join(des, "broken_file_symlink"))).toBe(false);
        expect(existsSync(path.join(des, "broken_folder_symlink"))).toBe(false);
        expect(existsSync(path.join(des, "broken_folder_symlink2"))).toBe(false);
    });
});
