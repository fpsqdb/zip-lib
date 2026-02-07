import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "vitest";
import * as zl from "../../src";

describe("zip", () => {
    it("zip a folder only contains subfolders and without any files.", async () => {
        try {
            const target = path.join(__dirname, "../zips/name with space.zip");
            await zl.archiveFolder(path.join(__dirname, "../resources/name with space"), target);
            const unzipTarget = path.join(__dirname, "../unzips/name with space");
            await zl.extract(target, unzipTarget, {
                overwrite: true,
            });
            fs.accessSync(path.join(unzipTarget, "/empty folder"));
            assert.ok(true, "zip a single empty folder");
        } catch (error) {
            assert.fail(error);
        }
    });
    it("zip an empty folder", async () => {
        try {
            const target = path.join(__dirname, "../zips/empty.zip");
            await zl.archiveFolder(path.join(__dirname, "../resources/name with space/empty folder"), target);
            const unzipTarget = path.join(__dirname, "../unzips/empty");
            await zl.extract(target, unzipTarget, {
                overwrite: true,
            });
            const files = fs.readdirSync(unzipTarget);
            if (files.length > 0) {
                assert.fail(`${unzipTarget} is not empty`);
            } else {
                assert.ok(true, "zip a single empty folder");
            }
        } catch (error) {
            assert.fail(error);
        }
    });
    it("zip an empty folder with metadataPath", async () => {
        try {
            const target = path.join(__dirname, "../zips/empty_with_metadata.zip");
            const zip = new zl.Zip();
            zip.addFolder(path.join(__dirname, "../resources/name with space/empty folder"), "root");
            await zip.archive(target);
            const unzipTarget = path.join(__dirname, "../unzips/empty_with_metadata");
            await zl.extract(target, unzipTarget, {
                overwrite: true,
            });
            fs.accessSync(path.join(unzipTarget, "/root"));
            assert.ok(true, "zip a single empty folder");
        } catch (error) {
            assert.fail(error);
        }
    });
});
