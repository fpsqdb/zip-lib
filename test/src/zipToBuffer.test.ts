import * as assert from "node:assert";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "vitest";
import * as zl from "../../src";

describe("zip to buffer", () => {
    it("zip single file", async () => {
        try {
            const buffer = await zl.archiveFile(
                path.join(__dirname, "../../package.json")
            );
            mkdirSync(path.join(__dirname, "../zips/buffer_test"), { recursive: true });
            writeFileSync(path.join(__dirname, "../zips/buffer_test/package.zip"), buffer);
            await zl.extract(path.join(__dirname, "../zips/buffer_test/package.zip"), path.join(__dirname, "../unzips/buffer_test/package"));
            assert.ok(existsSync(path.join(__dirname, "../unzips/buffer_test/package/package.json")));
            assert.ok(true, "zip single file");
        } catch (error) {
            assert.fail(error);
        }
    });
    it("zip folder", async () => {
        try {
            const buffer = await zl.archiveFolder(path.join(__dirname, "../resources"));
            mkdirSync(path.join(__dirname, "../zips/buffer_test"), { recursive: true });
            writeFileSync(path.join(__dirname, "../zips/buffer_test/resources.zip"), buffer);
            await zl.extract(path.join(__dirname, "../zips/buffer_test/resources.zip"), path.join(__dirname, "../unzips/buffer_test/resources"));
            assert.ok(existsSync(path.join(__dirname, "../unzips/buffer_test/resources/subfolder/test.txt")));

            assert.ok(true, "zip folder");
        } catch (error) {
            assert.fail(error);
        }
    });
});
