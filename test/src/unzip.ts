import * as za from "../../lib"
import * as path from "path";
import * as fs from "fs";
import * as assert from "assert";
import { promisify } from "util";

describe("unzip", () => {
    it("extract a zip file that does not exist", async () => {
        try {
            await za.extract(path.join(__dirname, "../asdfasdfasdf.zip"), path.join(__dirname, "../unzips/asdfasdfasdf"));
            assert.fail("extract a zip file that does not exist");
        } catch (error) {
            if (error.code === "ENOENT") {
                assert.ok(true, "code ENOENT as expected");
            } else {
                assert.fail(error);
            }
        }
    });
    it("extract a zip file", async () => {
        try {
            await za.extract(path.join(__dirname, "../unzipResources/resources.zip"), path.join(__dirname, "../unzips/resources"));
            assert.ok(true, "extract a zip file");
        } catch (error) {
            assert.fail(error);
        }
    });
    it("file name encoding", async () => {
        try {
            let expectedFileName = "¹ º » ¼ ½ ¾.txt";
            await za.extract(path.join(__dirname, "../unzipResources/resources_macos.zip"), path.join(__dirname, "../unzips/resources_macos"));
            await promisify(fs.access)(path.join(__dirname, "../unzips/resources_macos/", expectedFileName));
            assert.ok(true, "file name encoding");
        } catch (error) {
            assert.fail(error);
        }
    });
});