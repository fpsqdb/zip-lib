import { expect } from "vitest";

export function isErrorWithCode(error: unknown, code: string): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export function isErrorWithName(error: unknown, name: string): boolean {
    return typeof error === "object" && error !== null && "name" in error && error.name === name;
}

export function warnWindowsSymlinkPermission(): void {
    console.warn("Please run this test with administrator.");
}

function isWindowsSymlinkSupportError(error: unknown): boolean {
    return process.platform === "win32" && isErrorWithCode(error, "EPERM");
}

export async function allowWindowsSymlinkPermissionError(action: () => Promise<void>): Promise<boolean> {
    try {
        await action();
        return false;
    } catch (error) {
        if (isWindowsSymlinkSupportError(error)) {
            warnWindowsSymlinkPermission();
            return true;
        }
        throw error;
    }
}

export async function expectNamedErrorOrWindowsPermission(
    action: () => Promise<void>,
    expectedName: string,
    failureMessage: string,
): Promise<void> {
    try {
        await action();
        throw new Error(failureMessage);
    } catch (error) {
        if (isWindowsSymlinkSupportError(error)) {
            warnWindowsSymlinkPermission();
            return;
        }
        expect(error).toMatchObject({ name: expectedName });
    }
}

export async function allowNamedErrorOrWindowsPermission(
    action: () => Promise<void>,
    expectedName: string,
): Promise<void> {
    try {
        await action();
    } catch (error) {
        if (isWindowsSymlinkSupportError(error)) {
            warnWindowsSymlinkPermission();
            return;
        }
        if (isErrorWithName(error, expectedName)) {
            return;
        }
        throw error;
    }
}

export async function expectNonWindowsFailureOrAllowWindowsPermission(
    action: () => Promise<void>,
    expectedName: string,
    failureMessage: string,
): Promise<void> {
    try {
        await action();
        if (process.platform !== "win32") {
            throw new Error(failureMessage);
        }
    } catch (error) {
        if (isWindowsSymlinkSupportError(error)) {
            warnWindowsSymlinkPermission();
            return;
        }
        if (isErrorWithName(error, expectedName)) {
            return;
        }
        throw error;
    }
}
