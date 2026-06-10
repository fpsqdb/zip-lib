/** biome-ignore-all lint/suspicious/noExplicitAny: <any> */
import { describe, expect, it, vi } from "vitest";
import * as zl from "../../src";
import { CancellationToken } from "../../src/cancelable";
import * as exfs from "../../src/fs";

describe("internal coverage", () => {
    it("rejects invalid unzip entry names", async () => {
        const unzip = new zl.Unzip();

        await expect(
            (unzip as any).handleZipEntry(
                {},
                { fileName: Buffer.from("../evil.txt") },
                {},
                {},
                new CancellationToken(),
            ),
        ).rejects.toThrow(/invalid/i);
    });

    it("stops walking folders when zip is already canceled", async () => {
        const zip = new zl.Zip();
        const token = new CancellationToken();
        const readdirSpy = vi.spyOn(exfs, "readdirp");

        token.cancel();
        await (zip as any).walkDir({}, [{ path: "ignored" }], token);

        expect(readdirSpy).not.toHaveBeenCalled();
        readdirSpy.mockRestore();
    });

    it("stops walking remaining entries after zip cancellation", async () => {
        const zip = new zl.Zip();
        const token = new CancellationToken();
        const readdirSpy = vi.spyOn(exfs, "readdirp").mockResolvedValue([
            { path: "first.txt", isSymbolicLink: false, type: "file", mtime: new Date(), mode: 0o100644 },
            { path: "second.txt", isSymbolicLink: false, type: "file", mtime: new Date(), mode: 0o100644 },
        ]);
        const addEntrySpy = vi.spyOn(zip as any, "addEntry").mockImplementation(async () => {
            token.cancel();
        });

        await (zip as any).walkDir({}, [{ path: "folder", metadataPath: undefined }], token);

        expect(addEntrySpy).toHaveBeenCalledTimes(1);
        readdirSpy.mockRestore();
        addEntrySpy.mockRestore();
    });
});
