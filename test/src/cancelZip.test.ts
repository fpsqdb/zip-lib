import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";

describe("zip", () => {
    it("cancel zip to file", async () => {
        const zip = new zl.Zip();
        const target = path.join(__dirname, "../zips/node_modules.zip");
        zip.addFolder(path.join(__dirname, "../../node_modules"));
        setTimeout(() => {
            zip.cancel();
        }, 500);
        await expect(zip.archive(target)).rejects.toMatchObject({ name: "Canceled" });
    });

    it("cancel zip to buffer", async () => {
        const zip = new zl.Zip();
        zip.addFolder(path.join(__dirname, "../../node_modules"));
        setTimeout(() => {
            zip.cancel();
        }, 500);
        await expect(zip.archive()).rejects.toMatchObject({ name: "Canceled" });
    });

    it("cancel zip and try again", async () => {
        const zip = new zl.Zip();
        const target = path.join(__dirname, "../zips/node_modules.zip");
        zip.addFolder(path.join(__dirname, "../../node_modules"));
        setTimeout(() => {
            zip.cancel();
        }, 500);
        await expect(zip.archive(target)).rejects.toMatchObject({ name: "Canceled" });

        zip.addFile(path.join(__dirname, "../../package.json"));
        await zip.archive(target);
    }, 60000);

    it("cancel after zip completed", async () => {
        const zip = new zl.Zip();
        const target = path.join(__dirname, "../zips/package_cancel.zip");
        zip.addFile(path.join(__dirname, "../../package.json"));
        await zip.archive(target);
        zip.cancel();
    });
});
