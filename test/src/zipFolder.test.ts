import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";

describe("zip", () => {
    it("zip folder", async () => {
        await zl.archiveFolder(path.join(__dirname, "../resources"), path.join(__dirname, "../zips/resources.zip"));
    });

    it("zip a folder that does not exist", async () => {
        await expect(
            zl.archiveFolder(
                path.join(__dirname, "not_exist_folder"),
                path.join(__dirname, "../zips/not_exist_folder.zip"),
            ),
        ).rejects.toMatchObject({ code: "ENOENT" });
    });
});