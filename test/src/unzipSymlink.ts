import * as zl from "../../lib"
import * as util from "../../lib/util"
import * as path from "path";
import * as assert from "assert";

describe("unzip", () => {
    it("extract a zip file contains symlink", async () => {
        try {
            const des = path.join(__dirname, "../unzips/resources_with_symlink");
            await zl.extract(path.join(__dirname, "../unzipResources/resources_with_symlink.zip"), des, {
                overwrite: true,
                symlinkAsFileOnWindows: false
            });
            const stat = await util.lstat(path.join(des, "symlink"));
            if (stat.isSymbolicLink()) {
                assert.ok(true, "extract a zip file contains symlink");
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
    it("symlink to file on windows", async () => {
        try {
            const des = path.join(__dirname, "../unzips/resources_with_symlinkAsFile");
            await zl.extract(path.join(__dirname, "../unzipResources/resources_with_symlink.zip"), des, {
                overwrite: true
            });
            const stat = await util.lstat(path.join(des, "symlink"));
            if (stat.isSymbolicLink()) {
                assert.ok(true, "symlink to file on windows");
            } else {
                if (process.platform === "win32") {
                    assert.ok(true, "symlink to file on windows");
                } else {
                    assert.fail(`${path.join(des, "symlink")} is not a symlink`);
                }
            }
        } catch (error) {
            if (process.platform === "win32" &&
                error.code === "EPERM") {
                assert.ok(true, "Please run this test with administator.");
            } else {
                assert.fail(error);
            }
        }
    });
});