import * as zl from "../../dist";
import * as path from "path";
import * as assert from "assert";
import * as fs from "fs";

describe("zip", () => {
    it("zip with compressionLevel", async () => {
        try {
            await zl.archiveFile(path.join(__dirname, "../../package-lock.json"), path.join(__dirname, "../zips/package0.zip"), {
                compressionLevel: 0
            });
            await zl.archiveFile(path.join(__dirname, "../../package-lock.json"), path.join(__dirname, "../zips/package1.zip"), {
                compressionLevel: 1
            });
            await zl.archiveFile(path.join(__dirname, "../../package-lock.json"), path.join(__dirname, "../zips/package9.zip"), {
                compressionLevel: 9
            });
            const size0 = fs.statSync(path.join(__dirname, "../zips/package0.zip")).size;
            const size1 = fs.statSync(path.join(__dirname, "../zips/package1.zip")).size;
            const size9 = fs.statSync(path.join(__dirname, "../zips/package9.zip")).size;
            if (size0 <= size1) {
                assert.fail("Compression level 1 inflated size. expected: " + size0 + " > " + size1);
            }
            if (size1 <= size9) {
                assert.fail("Compression level 9 inflated size. expected: " + size1 + " > " + size9);
            }
            assert.ok(true, "zip with compressionLevel");
        } catch (error) {
            assert.fail(error);
        }
    });
});