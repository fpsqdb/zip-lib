import * as zl from "../../lib";
import * as path from "path";
import * as assert from "assert";
import * as exfs from "../../lib/fs";

describe("unzip", () => {
    it("extract a zip file with onEntry callback", async () => {
        try {
            const total: number = 9;
            let actual: number = 0;
            await zl.extract(path.join(__dirname, "../unzipResources/resources.zip"), path.join(__dirname, "../unzips/resources_sourcepath"), {
                onEntry: (event: zl.IEntryEvent) => {
                    actual = event.entryCount;
                }
            });
            if (actual !== total) {
                assert.fail(`entryCount, expected ${total} but ${actual}`);
            } else {
                assert.ok(true, "extract a zip file with onEntry callback");
            }
        } catch (error) {
            assert.fail(error);
        }
    });
    it("Exclude specified entries when extracting", async () => {
        try {
            const target = path.join(__dirname, "../unzips/resources_macos_without__MACOSX");
            await zl.extract(path.join(__dirname, "../unzipResources/resources_macos.zip"), target, {
                overwrite: true,
                onEntry: (event: zl.IEntryEvent) => {
                    if (/^__MACOSX\//.test(event.entryName)) {
                        // entry name starts with __MACOSX/
                        event.preventDefault();
                    }
                }
            });
            const exist = await exfs.pathExists(path.join(target, "__MACOSX"));
            if (exist) {
                assert.fail("Exclude specified entries when extracting");
            } else {
                assert.ok(true, "Exclude specified entries when extracting");
            }
        } catch (error) {
            assert.fail(error);
        }
    });
});