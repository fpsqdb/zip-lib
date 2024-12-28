import * as zl from "../../dist";
import * as fs from "fs/promises";
import * as path from "path";
import * as assert from "assert";
import * as fsSync from "fs";

describe("zip", () => {
    it("zip symlink (followSymlinks = false)", async () => {
        const source1 = path.join(__dirname, "../resources/symlink");
        const source2 = path.join(__dirname, "../resources/subfolder_symlink");
        if (process.platform === "win32") {
            if (!fsSync.existsSync(source1) || !fsSync.existsSync(source2)) {
                console.warn("Please run this test with administator.");
                return;
            }
            if (!fsSync.lstatSync(source1).isSymbolicLink() || !fsSync.lstatSync(source2).isSymbolicLink()) {
                console.warn("Please run this test with administator.");
                return;
            }
        }
        const zipFile = path.join(__dirname, "../zips/resources_allow_symlink.zip");
        try {
            await zl.archiveFolder(path.join(__dirname, "../resources"), zipFile);
        } catch (error) {
            assert.fail(error);
        }
        try {
            const des = path.join(__dirname, "../unzips/resources_allow_symlink");
            await zl.extract(zipFile, des, {
                overwrite: true,
                symlinkAsFileOnWindows: false
            });
            let passed = false;
            const stat1 = await fs.lstat(path.join(des, "symlink"));
            if (stat1.isSymbolicLink()) {
                passed = true;
            } else {
                assert.fail(`${path.join(des, "symlink")} is not a symlink`);
            }
            const stat2 = await fs.lstat(path.join(des, "subfolder_symlink"));
            if (stat2.isSymbolicLink()) {
                passed = true;
            } else {
                assert.fail(`${path.join(des, "subfolder_symlink")} is not a symlink`);
            }
            if (passed) {
                assert.ok(true, "zip symlink (followSymlinks = false)");
            }
        } catch (error) {
            if (process.platform === "win32" &&
                error.code === "EPERM") {
                console.warn("Please run this test with administator.");
                assert.ok(true, "Please run this test with administator.");
            } else {
                assert.fail(error);
            }
        }
    });
    it("zip symlink (followSymlinks = true)", async () => {
        const source1 = path.join(__dirname, "../resources/symlink");
        const source2 = path.join(__dirname, "../resources/subfolder_symlink");
        if (process.platform === "win32") {
            if (!fsSync.existsSync(source1) || !fsSync.existsSync(source2)) {
                console.warn("Please run this test with administator.");
                return;
            }
            if (!fsSync.lstatSync(source1).isSymbolicLink() || !fsSync.lstatSync(source2).isSymbolicLink()) {
                console.warn("Please run this test with administator.");
                return;
            }
        }
        const zipFile = path.join(__dirname, "../zips/resources_disallow_symlink.zip");
        try {
            await zl.archiveFolder(path.join(__dirname, "../resources"), zipFile, {
                followSymlinks: true
            });
        } catch (error) {
            assert.fail(error);
        }
        try {
            const des = path.join(__dirname, "../unzips/resources_disallow_symlink");
            await zl.extract(zipFile, des, {
                overwrite: true
            });
            let passed = false;
            const stat1 = await fs.lstat(path.join(des, "symlink"));
            if (stat1.isSymbolicLink()) {
                assert.fail(`${path.join(des, "symlink")} is a symlink`);
            } else {
                passed = true;
            }
            const stat2 = await fs.lstat(path.join(des, "subfolder_symlink"));
            if (stat2.isSymbolicLink()) {
                assert.fail(`${path.join(des, "subfolder_symlink")} is a symlink`);
            } else {
                passed = true;
            }
            if (passed) {
                assert.ok(true, "zip symlink (followSymlinks = true)");
            }
        } catch (error) {
            assert.fail(error);
        }
    });
});