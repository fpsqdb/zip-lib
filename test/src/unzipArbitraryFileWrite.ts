import * as zl from "../../dist";
import * as fs from "../../dist/fs";
import * as path from "path";
import * as assert from "assert";

describe("unzip", () => {
    it("extract a zip file that attempt to write file outside output folder", async () => {
        try {
            await zl.extract(path.join(__dirname, "../unzipResources/arbitrary_file_write.zip"), path.join(__dirname, "../unzips/arbitrary_file_write"), {
                overwrite: true,
                symlinkAsFileOnWindows: false
            });
            assert.fail("extract a zip file that attempt to write file outside output folder");
        } catch (error) {
            if (process.platform === "win32" &&
                error.code === "EPERM") {
                console.warn("Please run this test with administator.");
                assert.ok(true, "Please run this test with administator.");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }
    });
    it("extract a zip file that attempt to write file to symlink folder which is outside output folder", async () => {
        try {
            await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/output"));
            await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
            await fs.ensureFolder(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
            await zl.extract(path.join(__dirname, "../unzipResources/arbitrary_write/output1.zip"), path.join(__dirname, "../unzips/arbitrary_write/output"), {
                overwrite: false,
                symlinkAsFileOnWindows: false
            });
        } catch (error) {
            if (process.platform === "win32" &&
                error.code === "EPERM") {
                console.warn("Please run this test with administator.");
                assert.ok(true, "Please run this test with administator.");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }

        try {
            await zl.extract(path.join(__dirname, "../unzipResources/arbitrary_write/output2.zip"), path.join(__dirname, "../unzips/arbitrary_write/output"), {
                overwrite: false,
                symlinkAsFileOnWindows: false
            });
            if (process.platform === "win32") {
                assert.ok(true, "Please run this test with administator.");
            } else {
                assert.fail("extract a zip file that attempt to write file to symlink folder which is outside output folder");
            }
        } catch (error) {
            if (process.platform === "win32" &&
                error.code === "EPERM") {
                assert.ok(true, "Please run this test with administator.");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }

        try {
            await zl.extract(path.join(__dirname, "../unzipResources/arbitrary_write/output3.zip"), path.join(__dirname, "../unzips/arbitrary_write/output"), {
                overwrite: false,
                symlinkAsFileOnWindows: false
            });
            if (process.platform === "win32") {
                assert.ok(true, "Please run this test with administator.");
            } else {
                assert.fail("extract a zip file that attempt to write file to symlink folder which is outside output folder");
            }
        } catch (error) {
            if (process.platform === "win32" &&
                error.code === "EPERM") {
                assert.ok(true, "Please run this test with administator.");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }
    });
});