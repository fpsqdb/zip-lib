import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";
import * as exfs from "../../src/fs";

describe("unzip", () => {
    it("extract a zip file contains symlink", async () => {
        const des = path.join(__dirname, "../unzips/resources_with_symlink");
        await exfs.rimraf(des);
        await zl.extract(path.join(__dirname, "../unzipResources/resources_with_symlink.zip"), des, {
            overwrite: true,
            symlinkAsFileOnWindows: false,
        });
        const stat1 = await fs.lstat(path.join(des, "symlink"));
        const stat2 = await fs.lstat(path.join(des, "subfolder_symlink"));

        expect(stat1.isSymbolicLink(), `${path.join(des, "symlink")} is not a symlink`).toBe(true);
        expect(stat2.isSymbolicLink(), `${path.join(des, "subfolder_symlink")} is not a symlink`).toBe(true);
    });

    it("symlink to file on windows", async () => {
        const des = path.join(__dirname, "../unzips/resources_with_symlinkAsFile");
        await exfs.rimraf(des);
        await zl.extract(path.join(__dirname, "../unzipResources/resources_with_symlink.zip"), des, {
            overwrite: true,
        });
        const stat = await fs.lstat(path.join(des, "symlink"));

        if (process.platform === "win32") {
            expect(stat.isSymbolicLink()).toBe(false);
            return;
        }

        expect(stat.isSymbolicLink(), `${path.join(des, "symlink")} is not a symlink`).toBe(true);
    });
});
