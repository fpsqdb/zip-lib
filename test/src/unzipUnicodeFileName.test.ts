import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, it } from "vitest";
import * as zl from "../../src";

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
