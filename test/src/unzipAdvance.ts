import * as za from "../../lib"
import * as path from "path";
import * as assert from "assert";

describe("unzip", () => {
    it("extract a zip file with onEntry callback", async () => {
        try {
            let total: number = 9;
            let actual: number = 0;
            await za.extract(path.join(__dirname, "../unzipResources/resources.zip"), path.join(__dirname, "../unzips/resources_sourcepath"), {
                onEntry: (entryName: string, entryCount: number) => {
                    actual = entryCount;
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
});