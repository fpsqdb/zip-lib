import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import * as zl from "../../src";

const streamControls = vi.hoisted(() => {
    let markStarted: () => void = () => {
        // noop
    };
    const started = new Promise<void>((resolve) => {
        markStarted = resolve;
    });
    return {
        started,
        markStarted: (): void => markStarted(),
    };
});

vi.mock("node:fs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:fs")>();
    const { Readable } = await import("node:stream");

    // A stream that produces data slowly and delays its error event,
    // so a cancellation error is emitted after a retry has already started.
    const createSlowReadStream = () => {
        let remaining = 100;
        return new Readable({
            read() {
                if (remaining-- <= 0) {
                    this.push(null);
                    return;
                }
                setTimeout(() => this.push(Buffer.alloc(1024, 1)), 2);
            },
            destroy(error, callback) {
                setTimeout(() => callback(error), 100);
            },
        });
    };

    const createReadStream = ((filePath: string, options?: unknown) => {
        if (typeof filePath === "string" && filePath.endsWith("slow-read.txt")) {
            streamControls.markStarted();
            return createSlowReadStream();
        }
        return actual.createReadStream(filePath, options as Parameters<typeof actual.createReadStream>[1]);
    }) as typeof actual.createReadStream;

    return { ...actual, createReadStream };
});

const slowFolder = path.join(__dirname, "../zips/cancel_zip_retry");

afterAll(async () => {
    await fs.rm(slowFolder, { recursive: true, force: true });
});

describe("zip retry", () => {
    it("ignores an error from a cancelled archive when retrying", async () => {
        await fs.mkdir(slowFolder, { recursive: true });
        await fs.writeFile(path.join(slowFolder, "slow-read.txt"), "content");

        const zip = new zl.Zip();
        const target = path.join(__dirname, "../zips/cancel_zip_retry.zip");
        zip.addFolder(slowFolder);

        const firstArchive = zip.archive(target);
        await streamControls.started;
        zip.cancel();
        await expect(firstArchive).rejects.toMatchObject({ name: "Canceled" });

        // The cancelled stream emits its error while this retry is in progress.
        await expect(zip.archive(target)).resolves.toBeUndefined();
    }, 10000);
});
