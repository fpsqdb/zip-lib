import * as za from "../../lib"
import * as path from "path";
import * as assert from "assert";

describe("zip", () => {
    it("advance zip", async () => {
        try {
            const zip = new za.Zip();
            zip.addFile(path.join(__dirname, "../resources/src - shortcut.lnk"), "test.lnk");
            zip.addFile(path.join(__dirname, "../resources/¹ º » ¼ ½ ¾.txt"), "ddddd.txt");
            zip.addFolder(path.join(__dirname, "../resources/subfolder"), "new subfolder");
            zip.addFolder(path.join(__dirname, "../resources/name with space"));
            await zip.archive(path.join(__dirname, "../zips/resources_advance.zip"));
            assert.ok("advance zip");
        } catch (error) {
            assert.fail(error);
        }
    });
});