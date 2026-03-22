import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";

describe("zip to buffer", () => {
    it("zip single file", async () => {
        const buffer = await zl.archiveFile(path.join(__dirname, "../../package.json"));
        mkdirSync(path.join(__dirname, "../zips/buffer_test"), { recursive: true });
        writeFileSync(path.join(__dirname, "../zips/buffer_test/package.zip"), buffer);
        await zl.extract(path.join(__dirname, "../zips/buffer_test/package.zip"), path.join(__dirname, "../unzips/buffer_test/package"));
        expect(existsSync(path.join(__dirname, "../unzips/buffer_test/package/package.json"))).toBe(true);
    });

    it("zip folder", async () => {
        const buffer = await zl.archiveFolder(path.join(__dirname, "../resources"));
        mkdirSync(path.join(__dirname, "../zips/buffer_test"), { recursive: true });
        writeFileSync(path.join(__dirname, "../zips/buffer_test/resources.zip"), buffer);
        await zl.extract(path.join(__dirname, "../zips/buffer_test/resources.zip"), path.join(__dirname, "../unzips/buffer_test/resources"));
        expect(existsSync(path.join(__dirname, "../unzips/buffer_test/resources/subfolder/test.txt"))).toBe(true);
    });
});