import * as zl from "../../dist";
import * as util from "../../dist/util";
import * as path from "path";
import * as assert from "assert";

describe("unzip", () => {
    it("extract a zip file that does not exist", async () => {
        try {
            await zl.extract(path.join(__dirname, "../asdfasdfasdf.zip"), path.join(__dirname, "../unzips/asdfasdfasdf"));
            assert.fail("extract a zip file that does not exist");
        } catch (error) {
            if (error.code === "ENOENT") {
                assert.ok(true, "code ENOENT as expected");
            } else {
                assert.fail(error);
            }
        }
    });
    it("extract a zip file", async () => {
        try {
            const des = path.join(__dirname, "../unzips/resources");
            await zl.extract(path.join(__dirname, "../unzipResources/resources.zip"), des, {
                overwrite: true
            });
            await util.access(path.join(des, "«ταБЬℓσ»"));
            await util.access(path.join(des, "name with space/empty folder"));
            await util.access(path.join(des, "subfolder/test text.txt"));
            await util.access(path.join(des, "subfolder/test.txt"));
            await util.access(path.join(des, "subfolder/test.txt - shortcut.lnk"));
            await util.access(path.join(des, "¹ º » ¼ ½ ¾.txt"));
            await util.access(path.join(des, "src - shortcut.lnk"));
            assert.ok(true, "extract a zip file");
        } catch (error) {
            assert.fail(error);
        }
    });
    it("Extract a file that is not in zip format", async () => {
        try {
            const des = path.join(__dirname, "../unzips/invalid");
            await zl.extract(path.join(__dirname, "../resources/¹ º » ¼ ½ ¾.txt"), des, {
                overwrite: true
            });
            assert.fail("Extract a file that is not in zip format");
        } catch (error) {
            assert.ok(true, "Extract a file that is not in zip format");
        }
    });
    it("extract an corrupted zip file", async () => {
        try {
            const des = path.join(__dirname, "../unzips/zip_corrupted");
            await zl.extract(path.join(__dirname, "../unzipResources/zip_corrupted.zip"), des, {
                overwrite: true
            });
            assert.fail("extract an corrupted zip file");
        } catch (error) {
            assert.ok(true, "extract an corrupted zip file");
        }
    });
    it("file name encoding", async () => {
        try {
            const expectedFileName = "¹ º » ¼ ½ ¾.txt";
            await zl.extract(path.join(__dirname, "../unzipResources/resources_macos.zip"), path.join(__dirname, "../unzips/resources_macos"));
            await util.access(path.join(__dirname, "../unzips/resources_macos/", expectedFileName));
            assert.ok(true, "file name encoding");
        } catch (error) {
            assert.fail(error);
        }
    });
});