import * as zl from "../../lib"
import * as path from "path";
import * as assert from "assert";

describe("zip", () => {
    it("zip single file", async () => {
        try {
            await zl.archiveFile(path.join(__dirname, "../../package.json"), path.join(__dirname, "../zips/package.zip"));
            assert.ok(true, "zip single file");
        } catch (error) {
            assert.fail(error);
        }
    });
    it("zip a file that does not exist", async () => {
        try {
            await zl.archiveFile(path.join(__dirname, "asdfasdf.jsfasd"), path.join(__dirname, "../zips/safasdfafda.zip"));
            assert.fail("zip a file that does not exist");
        } catch (error) {
            if (error.code === "ENOENT") {
                assert.ok(true, "code ENOENT as expected");
            } else {
                assert.fail(error);
            }
        }
    });
});