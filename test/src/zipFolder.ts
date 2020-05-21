import * as zl from "../../lib";
import * as path from "path";
import * as assert from "assert";

describe("zip", () => {
    it("zip folder", async () => {
        try {
            await zl.archiveFolder(path.join(__dirname, "../resources"), path.join(__dirname, "../zips/resources.zip"));
            assert.ok(true, "zip folder");
        } catch (error) {
            assert.fail(error);
        }
    });
    it("zip a folder that does not exist", async () => {
        try {
            await zl.archiveFolder(path.join(__dirname, "asdfasdfasdf"), path.join(__dirname, "../zips/dddafsdasdf.zip"));
            assert.fail("zip a folder that does not exist");
        } catch (error) {
            if (error.code === "ENOENT") {
                assert.ok(true, "code ENOENT as expected");
            } else {
                assert.fail(error);
            }
        }
    });
});