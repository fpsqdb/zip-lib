import * as zl from "../../lib"
import * as path from "path";
import * as assert from "assert";

describe("zip", () => {
    it("cancel zip", async () => {
        try {
            const zip = new zl.Zip();
            const target = path.join(__dirname, "../zips/node_modules.zip");
            zip.addFolder(path.join(__dirname, "../../node_modules"));
            setTimeout(() => {
                zip.cancel();
            }, 500);
            await zip.archive(target);
            assert.fail("cancel zip");
        } catch (error) {
            if (error.name === "Canceled") {
                assert.ok(true, "cancel zip");
            } else {
                assert.fail(error);
            }
        }
    });
    it("cancel after zip completed", async () => {
        try {
            const zip = new zl.Zip();
            const target = path.join(__dirname, "../zips/package_cancel.zip");
            zip.addFile(path.join(__dirname, "../../package.json"));
            await zip.archive(target);
            zip.cancel();
            assert.ok(true, "cancel after zip completed");
        } catch (error) {
            if (error.name === "Canceled") {
                assert.ok(true, "cancel after zip completed");
            } else {
                assert.fail(error);
            }
        }
    });
});