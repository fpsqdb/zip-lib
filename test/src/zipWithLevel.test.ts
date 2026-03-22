import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";

describe("zip", () => {
    it("zip with compressionLevel", async () => {
        await zl.archiveFile(
            path.join(__dirname, "../../package-lock.json"),
            path.join(__dirname, "../zips/package0.zip"),
            {
                compressionLevel: 0,
            },
        );
        await zl.archiveFile(
            path.join(__dirname, "../../package-lock.json"),
            path.join(__dirname, "../zips/package1.zip"),
            {
                compressionLevel: 1,
            },
        );
        await zl.archiveFile(
            path.join(__dirname, "../../package-lock.json"),
            path.join(__dirname, "../zips/package9.zip"),
            {
                compressionLevel: 9,
            },
        );
        const size0 = fs.statSync(path.join(__dirname, "../zips/package0.zip")).size;
        const size1 = fs.statSync(path.join(__dirname, "../zips/package1.zip")).size;
        const size9 = fs.statSync(path.join(__dirname, "../zips/package9.zip")).size;
        expect(size0).toBeGreaterThan(size1);
        expect(size1).toBeGreaterThan(size9);
    });
});