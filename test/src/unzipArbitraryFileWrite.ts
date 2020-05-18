import * as zl from "../../lib"
import * as path from "path";
import * as assert from "assert";

describe("unzip", () => {
    it("extract a zip file that attempt to write file outside ouput folder", async () => {
        try {
            await zl.extract(path.join(__dirname, "../unzipResources/arbitrary_file_write.zip"), path.join(__dirname, "../unzips/arbitrary_file_write"), {
                overwrite: true,
                symlinkAsFileOnWindows: false
            });
            assert.fail("extract a zip file that attempt to write file outside ouput folder");
        } catch (error) {
            if (process.platform === "win32" &&
                error.code === "EPERM") {
                assert.ok(true, "code EPERM as expected");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }
    });
});