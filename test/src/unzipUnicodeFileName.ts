import * as zl from "../../dist";
import * as fs from "fs/promises";
import * as path from "path";
import * as assert from "assert";

describe("unzip", () => {
    it("Correct decode unicode file name", async () => {
        try {
            const des = path.join(__dirname, "../unzips/macos_chinese_filename");
            await zl.extract(path.join(__dirname, "../unzipResources/macos_chinese_filename.zip"), des, {
                overwrite: true,
            });
            await fs.access(path.join(des, "中文测试.md"));
            assert.ok(true, "Correct decode unicode file name");
        } catch (error) {
            assert.fail(error);
        }
    });
});