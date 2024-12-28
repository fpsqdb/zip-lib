import * as zl from "../../dist";
import * as path from "path";
import * as assert from "assert";
import * as fs from "fs";

describe("zip", () => {
    it("advance zip", async () => {
        try {
            const zip = new zl.Zip();
            zip.addFile(path.join(__dirname, "../resources/src - shortcut.lnk"), "test.lnk");
            zip.addFile(path.join(__dirname, "../resources/¹ º » ¼ ½ ¾.txt"), "ddddd.txt");
            zip.addFolder(path.join(__dirname, "../resources/subfolder"), "new subfolder");
            zip.addFolder(path.join(__dirname, "../resources/name with space"));
            const target = path.join(__dirname, "../zips/resources_advance.zip");
            await zip.archive(target);
            const unzipTarget = path.join(__dirname, "../unzips/resources_advance");
            await zl.extract(target, unzipTarget, {
                overwrite: true
            });
            fs.accessSync(path.join(unzipTarget, "test.lnk"));
            fs.accessSync(path.join(unzipTarget, "ddddd.txt"));
            fs.accessSync(path.join(unzipTarget, "new subfolder/test text.txt"));
            fs.accessSync(path.join(unzipTarget, "new subfolder/test.txt"));
            const exist = fs.existsSync(path.join(unzipTarget, "new subfolder/test.txt - shortcut.lnk"));
            if (!exist) {
                assert.fail(`${path.join(unzipTarget, "new subfolder/test.txt - shortcut.lnk")} does not exist.`);
            } else {
                assert.ok("advance zip");
            }
        } catch (error) {
            assert.fail(error);
        }
    });
});