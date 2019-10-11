import * as za from "../../lib"
import * as path from "path";
import * as assert from "assert";

describe("zip", () => {
    it("zip symlink normal", async () => {
        try {
            await za.archiveFile(path.join(__dirname, "../resources/symlink"), path.join(__dirname, "../zips/symlink_link.zip"), {
                overwrite: true
            });
            assert.ok(true, "zip symlink as link");
        } catch (error) {     
            assert.fail(error);
        }
    });
    it("zip symlink as file", async () => {
        try {
            await za.archiveFile(path.join(__dirname, "../resources/symlink"), path.join(__dirname, "../zips/symlink.zip"), {
                overwrite: true,
                storeSymlinkAsFile: true
            });
            assert.ok(true, "zip symlink as file");
        } catch (error) {     
            assert.fail(error);
        }
    });
});