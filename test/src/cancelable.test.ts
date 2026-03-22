import { describe, expect, it } from "vitest";
import { CancellationToken } from "../../src/cancelable";

describe("cancelable", () => {
    it("fires callbacks registered after cancellation immediately", () => {
        const token = new CancellationToken();
        let called = 0;

        token.cancel();
        const dispose = token.onCancelled(() => {
            called++;
        });

        dispose();

        expect(called).toBe(1);
    });

    it("ignores repeated cancellation", () => {
        const token = new CancellationToken();
        let called = 0;

        token.onCancelled(() => {
            called++;
        });

        token.cancel();
        token.cancel();

        expect(called).toBe(1);
    });
});
