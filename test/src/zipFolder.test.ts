import * as assert from "node:assert";
import * as path from "node:path";
import { describe, it } from "vitest";
import * as zl from "../../src";

describe("zip", () => {
    it("zip folder", async () => {
        try {
            await zl.archiveFolder(path.join(__dirname, "../resources"), path.join(__dirname, "../zips/resources.zip"));
            assert.ok(true, "zip folder");
        } catch (error) {
            assert.fail(error);
        }
    });
    it("zip a folder that does not exist", async () => {
        try {
            await zl.archiveFolder(
                path.join(__dirname, "not_exist_folder"),
                path.join(__dirname, "../zips/not_exist_folder.zip"),
            );
            assert.fail("zip a folder that does not exist");
        } catch (error) {
            if (error.code === "ENOENT") {
                assert.ok(true, "code ENOENT as expected");
            } else {
                assert.fail(error);
            }
        }
    });
});
