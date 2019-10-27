import * as zl from "../../lib"
import * as util from "../../lib/util"
import * as path from "path";
import * as assert from "assert";

describe("zip", () => {
    it("zip symlink normal", async () => {
        const zipFile = path.join(__dirname, "../zips/symlink_link.zip");
        try {
            await zl.archiveFile(path.join(__dirname, "../resources/symlink"), zipFile);
        } catch (error) {
            assert.fail(error);
            return;
        }
        try {
            const des = path.join(__dirname, "../unzips/symlink_link");
            await zl.extract(zipFile, des, {
                overwrite: true,
                symlinkAsFileOnWindows: false
            });
            const stat = await util.lstat(path.join(des, "symlink"));
            if (stat.isSymbolicLink()) {
                assert.ok(true, "zip symlink normal");
            } else {
                assert.fail(`${path.join(des, "symlink")} is not a symlink`);
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
    it("zip symlink as file", async () => {
        const zipFile = path.join(__dirname, "../zips/symlink_asfile.zip");
        try {
            await zl.archiveFile(path.join(__dirname, "../resources/symlink"), zipFile, {
                storeSymlinkAsFile: true
            });
            assert.ok(true, "zip symlink as file");
        } catch (error) {
            assert.fail(error);
        }
        try {
            const des = path.join(__dirname, "../unzips/symlink_asfile");
            await zl.extract(zipFile, des, {
                overwrite: true
            });
            const stat = await util.lstat(path.join(des, "symlink"));
            if (stat.isSymbolicLink()) {
                assert.fail(`${path.join(des, "symlink")} is a symlink`);
            } else {
                assert.ok(true, "zip symlink as file");
            }
        } catch (error) {
            assert.fail(error);
        }
    });
});