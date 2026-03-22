import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "vitest";
import * as zl from "../../src";

describe("unzip", () => {
    it("cancel extract from zip file", async () => {
        try {
            const unzip = new zl.Unzip({
                overwrite: true,
            });
            setTimeout(() => {
                unzip.cancel();
            }, 100);
            await unzip.extract(
                path.join(__dirname, "../unzipResources/node_modules.zip"),
                path.join(__dirname, "../unzips/node_modules_from_zip"),
            );
            assert.fail("cancel extract from zip file");
        } catch (error) {
            if (error.name === "Canceled") {
                assert.ok(true, "cancel extract from zip file");
            } else {
                assert.fail(error);
            }
        }
    }, 10000);
    it("cancel extract from buffer", async () => {
        try {
            const zipBuffer = readFileSync(path.join(__dirname, "../unzipResources/node_modules.zip"));
            const unzip = new zl.Unzip({
                overwrite: true,
            });
            setTimeout(() => {
                unzip.cancel();
            }, 100);
            await unzip.extract(zipBuffer, path.join(__dirname, "../unzips/node_modules_from_buffer"));
            assert.fail("cancel extract from buffer");
        } catch (error) {
            if (error.name === "Canceled") {
                assert.ok(true, "cancel extract from buffer");
            } else {
                assert.fail(error);
            }
        }
    }, 10000);
    it("cancel extract zip file and try again", async () => {
        const unzip = new zl.Unzip({
            overwrite: true,
        });
        const source = path.join(__dirname, "../unzipResources/node_modules.zip");
        const target = path.join(__dirname, "../unzips/node_modules_retry");
        try {
            setTimeout(() => {
                unzip.cancel();
            }, 100);
            await unzip.extract(source, target);
        } catch (error) {
            if (error.name !== "Canceled") {
                assert.fail(error);
            }
        }
        try {
            await unzip.extract(source, target);
            assert.ok(true, "cancel extract zip file and try again");
        } catch (error) {
            assert.fail(error);
        }
    }, 60000);
    it("cancel extract from buffer and try again", async () => {
        const unzip = new zl.Unzip({
            overwrite: true,
        });
        const zipBuffer = readFileSync(path.join(__dirname, "../unzipResources/node_modules.zip"));
        const target = path.join(__dirname, "../unzips/node_modules_from_buffer_retry");
        try {
            setTimeout(() => {
                unzip.cancel();
            }, 100);
            await unzip.extract(zipBuffer, target);
        } catch (error) {
            if (error.name !== "Canceled") {
                assert.fail(error);
            }
        }
        try {
            await unzip.extract(zipBuffer, target);
            assert.ok(true, "cancel extract from buffer and try again");
        } catch (error) {
            assert.fail(error);
        }
    }, 60000);
    it("cancel extract zip file after completed", async () => {
        try {
            const unzip = new zl.Unzip({
                overwrite: true,
            });
            await unzip.extract(
                path.join(__dirname, "../unzipResources/resources.zip"),
                path.join(__dirname, "../unzips/resources_cancel"),
            );
            unzip.cancel();
            assert.ok(true, "cancel extract zip file after completed");
        } catch (error) {
            assert.fail(error);
        }
    });
});
