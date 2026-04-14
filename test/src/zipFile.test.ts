import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";

describe("zip", () => {
    it("zip single file", async () => {
        await zl.archiveFile(path.join(__dirname, "../../package.json"), path.join(__dirname, "../zips/package.zip"));
    });

    it("zip a file that does not exist", async () => {
        await expect(
            zl.archiveFile(path.join(__dirname, "not_exist_file.file"), path.join(__dirname, "../zips/not_exist_file.zip")),
        ).rejects.toMatchObject({ code: "ENOENT" });
    });
});
