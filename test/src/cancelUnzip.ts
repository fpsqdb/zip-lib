import * as zl from "../../lib"
import * as path from "path";
import * as assert from "assert";

describe("unzip", () => {
    it("cancel extract zip file", async () => {
        try {
            const unzip = new zl.Unzip({
                overwrite: true
            });
            setTimeout(() => {
                unzip.cancel();
            }, 100);
            await unzip.extract(path.join(__dirname, "../unzipResources/node_modules.zip"), path.join(__dirname, "../unzips/node_modules"));
            assert.fail("cancel extract zip file");
        } catch (error) {
            if (error.name === "Canceled") {
                assert.ok(true, "cancel extract zip file");
            } else {
                assert.fail(error);
            }
        }
    });
});