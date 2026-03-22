import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";
import * as exfs from "../../src/fs";

describe("unzip", () => {
    it("extract a zip file with onEntry callback", async () => {
        const total = 9;
        let actual = 0;
        await zl.extract(
            path.join(__dirname, "../unzipResources/resources.zip"),
            path.join(__dirname, "../unzips/resources_source_path"),
            {
                onEntry: (event: zl.IEntryEvent) => {
                    actual = event.entryCount;
                },
            },
        );
        expect(actual).toBe(total);
    });

    it("Exclude specified entries when extracting", async () => {
        const target = path.join(__dirname, "../unzips/resources_macos_without__MACOSX");
        await zl.extract(path.join(__dirname, "../unzipResources/resources_macos.zip"), target, {
            overwrite: true,
            onEntry: (event: zl.IEntryEvent) => {
                if (/^__MACOSX\//.test(event.entryName)) {
                    event.preventDefault();
                }
            },
        });
        const exist = await exfs.pathExists(path.join(target, "__MACOSX"));
        expect(exist).toBe(false);
    });
});
