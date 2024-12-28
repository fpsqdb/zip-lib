import * as zl from "../../dist";
import * as path from "path";
import * as assert from "assert";

describe("zip", () => {
    it("zip a archive file twice", async () => {
        try {
            const twiceFile = path.join(__dirname, "../zips/resources_zip_twice.zip");
            await zl.archiveFile(path.join(__dirname, "../unzipResources/resources.zip"), twiceFile);
            await zl.extract(twiceFile, path.join(__dirname, "../zips/resources_zip_twice"), {
                overwrite: true
            });
            const resourcesZip = path.join(__dirname, "../zips/resources_zip_twice/resources.zip");
            await zl.extract(resourcesZip, path.join(__dirname, "../zips/resources_zip_twice/resources"), {
                overwrite: true
            });
            assert.ok(true, "zip a archive file twice");
        } catch (error) {
            assert.fail(error);
        }
    });
});