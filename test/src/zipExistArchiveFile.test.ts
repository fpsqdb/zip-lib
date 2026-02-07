import * as assert from "node:assert";
import * as path from "node:path";
import { describe, it } from "vitest";
import * as zl from "../../src";

describe("zip", () => {
    it("zip a archive file twice", async () => {
        try {
            const twiceFile = path.join(__dirname, "../zips/resources_zip_twice.zip");
            await zl.archiveFile(path.join(__dirname, "../unzipResources/resources.zip"), twiceFile);
            await zl.extract(twiceFile, path.join(__dirname, "../zips/resources_zip_twice"), {
                overwrite: true,
            });
            const resourcesZip = path.join(__dirname, "../zips/resources_zip_twice/resources.zip");
            await zl.extract(resourcesZip, path.join(__dirname, "../zips/resources_zip_twice/resources"), {
                overwrite: true,
            });
            assert.ok(true, "zip a archive file twice");
        } catch (error) {
            assert.fail(error);
        }
    });
});
