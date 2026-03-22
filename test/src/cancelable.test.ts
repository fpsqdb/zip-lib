import * as assert from "node:assert";
import { describe, it } from "vitest";
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

        assert.equal(called, 1);
    });

    it("ignores repeated cancellation", () => {
        const token = new CancellationToken();
        let called = 0;

        token.onCancelled(() => {
            called++;
        });

        token.cancel();
        token.cancel();

        assert.equal(called, 1);
    });
});
