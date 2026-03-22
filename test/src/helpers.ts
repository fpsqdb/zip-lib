import { expect } from "vitest";

export function isErrorWithCode(error: unknown, code: string): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export function isErrorWithName(error: unknown, name: string): boolean {
    return typeof error === "object" && error !== null && "name" in error && error.name === name;
}

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

export async function allowNamedError(action: () => Promise<void>, expectedName: string): Promise<void> {
    try {
        await action();
    } catch (error) {
        if (isErrorWithName(error, expectedName)) {
            return;
        }
        throw error;
    }
}
