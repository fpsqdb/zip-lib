import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";

describe("unzip", () => {
    it("extract a zip file that does not exist", async () => {
        await expect(
            zl.extract(path.join(__dirname, "../not_exist.zip"), path.join(__dirname, "../unzips/not_exist")),
        ).rejects.toMatchObject({
            code: "ENOENT",
        });
    });

    it("extract a zip file", async () => {
        const des = path.join(__dirname, "../unzips/resources");
        await zl.extract(path.join(__dirname, "../unzipResources/resources.zip"), des, {
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

    it("Extract a file that is not in zip format", async () => {
        const des = path.join(__dirname, "../unzips/invalid");
        await expect(
            zl.extract(path.join(__dirname, "../resources/¹ º » ¼ ½ ¾.txt"), des, {
                overwrite: true,
            }),
        ).rejects.toBeDefined();
    });

    it("extract an corrupted zip file", async () => {
        const des = path.join(__dirname, "../unzips/zip_corrupted");
        await expect(
            zl.extract(path.join(__dirname, "../unzipResources/zip_corrupted.zip"), des, {
                overwrite: true,
            }),
        ).rejects.toBeDefined();
    });

    it("file name encoding", async () => {
        const expectedFileName = "¹ º » ¼ ½ ¾.txt";
        await zl.extract(
            path.join(__dirname, "../unzipResources/resources_macos.zip"),
            path.join(__dirname, "../unzips/resources_macos"),
        );
        await fs.access(path.join(__dirname, "../unzips/resources_macos/", expectedFileName));
    });
});
