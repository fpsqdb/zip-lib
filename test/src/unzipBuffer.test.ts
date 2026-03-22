import { readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";

describe("unzip buffer", () => {
    it("extract a buffer that is not a zip format", async () => {
        await expect(zl.extract(Buffer.from([1]), path.join(__dirname, "../unzips/not_exist"))).rejects.toBeDefined();
    });

    it("extract a zip file", async () => {
        const des = path.join(__dirname, "../unzips/buffer_test/resources2");
        const buffer = readFileSync(path.join(__dirname, "../unzipResources/resources.zip"));
        await zl.extract(buffer, des, {
            overwrite: true,
        });
        await fs.access(path.join(des, "«ταБЬℓσ»"));
        await fs.access(path.join(des, "name with space/empty folder"));
        await fs.access(path.join(des, "subfolder/test text.txt"));
        await fs.access(path.join(des, "subfolder/test.txt"));
        await fs.access(path.join(des, "subfolder/test.txt - shortcut.lnk"));
        await fs.access(path.join(des, "¹ º » ¼ ½ ¾.txt"));
        await fs.access(path.join(des, "src - shortcut.lnk"));
    });
});