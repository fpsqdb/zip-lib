import { expect } from "vitest";

export async function expectNamedError(
    action: () => Promise<void>,
    expectedName: string,
    failureMessage: string,
): Promise<void> {
    try {
        await action();
        throw new Error(failureMessage);
    } catch (error) {
        expect(error).toMatchObject({ name: expectedName });
    }
}

export async function expectCodeError(
    action: () => Promise<void>,
    expectedCode: string,
    failureMessage: string,
): Promise<void> {
    try {
        await action();
        throw new Error(failureMessage);
    } catch (error) {
        expect(error).toMatchObject({ code: expectedCode });
    }
}
