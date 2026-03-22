import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";

describe("unzip", () => {
    it("cancel extract from zip file", async () => {
        const unzip = new zl.Unzip({
            overwrite: true,
        });
        setTimeout(() => {
            unzip.cancel();
        }, 100);
        await expect(
            unzip.extract(
                path.join(__dirname, "../unzipResources/node_modules.zip"),
                path.join(__dirname, "../unzips/node_modules_from_zip"),
            ),
        ).rejects.toMatchObject({ name: "Canceled" });
    }, 10000);

    it("cancel extract from buffer", async () => {
        const zipBuffer = readFileSync(path.join(__dirname, "../unzipResources/node_modules.zip"));
        const unzip = new zl.Unzip({
            overwrite: true,
        });
        setTimeout(() => {
            unzip.cancel();
        }, 100);
        await expect(
            unzip.extract(zipBuffer, path.join(__dirname, "../unzips/node_modules_from_buffer")),
        ).rejects.toMatchObject({
            name: "Canceled",
        });
    }, 10000);

    it("cancel extract zip file and try again", async () => {
        const unzip = new zl.Unzip({
            overwrite: true,
        });
        const source = path.join(__dirname, "../unzipResources/node_modules.zip");
        const target = path.join(__dirname, "../unzips/node_modules_retry");
        setTimeout(() => {
            unzip.cancel();
        }, 100);
        await expect(unzip.extract(source, target)).rejects.toMatchObject({ name: "Canceled" });

        await unzip.extract(source, target);
    }, 60000);

    it("cancel extract from buffer and try again", async () => {
        const unzip = new zl.Unzip({
            overwrite: true,
        });
        const zipBuffer = readFileSync(path.join(__dirname, "../unzipResources/node_modules.zip"));
        const target = path.join(__dirname, "../unzips/node_modules_from_buffer_retry");
        setTimeout(() => {
            unzip.cancel();
        }, 100);
        await expect(unzip.extract(zipBuffer, target)).rejects.toMatchObject({ name: "Canceled" });

        await unzip.extract(zipBuffer, target);
    }, 60000);

    it("cancel extract zip file after completed", async () => {
        const unzip = new zl.Unzip({
            overwrite: true,
        });
        await unzip.extract(
            path.join(__dirname, "../unzipResources/resources.zip"),
            path.join(__dirname, "../unzips/resources_cancel"),
        );
        unzip.cancel();
    });
});
