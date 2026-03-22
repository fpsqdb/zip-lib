import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";
import * as fs from "../../src/fs";

function isErrorWithCode(error: unknown, code: string): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function isErrorWithName(error: unknown, name: string): boolean {
    return typeof error === "object" && error !== null && "name" in error && error.name === name;
}

function warnWindowsSymlinkPermission(): void {
    console.warn("Please run this test with administrator.");
}

async function expectNamedErrorOrWindowsPermission(
    action: () => Promise<void>,
    expectedName: string,
    failureMessage: string,
): Promise<void> {
    try {
        await action();
        throw new Error(failureMessage);
    } catch (error) {
        if (process.platform === "win32" && isErrorWithCode(error, "EPERM")) {
            warnWindowsSymlinkPermission();
            return;
        }
        expect(error).toMatchObject({ name: expectedName });
    }
}

async function allowNamedErrorOrWindowsPermission(action: () => Promise<void>, expectedName: string): Promise<void> {
    try {
        await action();
    } catch (error) {
        if (process.platform === "win32" && isErrorWithCode(error, "EPERM")) {
            warnWindowsSymlinkPermission();
            return;
        }
        if (isErrorWithName(error, expectedName)) {
            return;
        }
        throw error;
    }
}

async function expectNonWindowsFailureOrAllowWindowsPermission(
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
        if (process.platform === "win32" && isErrorWithCode(error, "EPERM")) {
            warnWindowsSymlinkPermission();
            return;
        }
        if (isErrorWithName(error, expectedName)) {
            return;
        }
        throw error;
    }
}

describe("unzip, safeSymlinksOnly=false", () => {
    it("extract a zip file that attempt to write file outside output folder, case 1, safeSymlinksOnly=false", async () => {
        await expectNamedErrorOrWindowsPermission(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_file_write.zip"),
                    path.join(__dirname, "../unzips/arbitrary_file_write"),
                    {
                        overwrite: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AFWRITE",
            "extract a zip file that attempt to write file outside output folder, case 1, safeSymlinksOnly=false",
        );
    });

    it("extract a zip file that attempt to write file outside output folder, case 2, safeSymlinksOnly=false", async () => {
        await expectNamedErrorOrWindowsPermission(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_file_write2.zip"),
                    path.join(__dirname, "../unzips/arbitrary_file_write2"),
                    {
                        overwrite: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AFWRITE",
            "extract a zip file that attempt to write file outside output folder, case 2, safeSymlinksOnly=false",
        );
    });

    it("extract a zip file that attempt to write file to symlink folder which is outside output folder, safeSymlinksOnly=false", async () => {
        await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/output"));
        await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
        await fs.ensureFolder(path.join(__dirname, "../unzips/arbitrary_write/tmp"));

        await allowNamedErrorOrWindowsPermission(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_write/output1.zip"),
                    path.join(__dirname, "../unzips/arbitrary_write/output"),
                    {
                        overwrite: false,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AFWRITE",
        );

        await expectNonWindowsFailureOrAllowWindowsPermission(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_write/output2.zip"),
                    path.join(__dirname, "../unzips/arbitrary_write/output"),
                    {
                        overwrite: false,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AFWRITE",
            "extract a zip file that attempt to write file to symlink folder which is outside output folder",
        );

        await expectNonWindowsFailureOrAllowWindowsPermission(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_write/output3.zip"),
                    path.join(__dirname, "../unzips/arbitrary_write/output"),
                    {
                        overwrite: false,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AFWRITE",
            "extract a zip file that attempt to write file to symlink folder which is outside output folder",
        );
    });
});

describe("unzip, safeSymlinksOnly=true", () => {
    it("extract a zip file that attempt to write file outside output folder, case 1, safeSymlinksOnly=true", async () => {
        await expectNamedErrorOrWindowsPermission(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_file_write.zip"),
                    path.join(__dirname, "../unzips/arbitrary_file_write"),
                    {
                        overwrite: true,
                        safeSymlinksOnly: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AF_ILLEGAL_TARGET",
            "extract a zip file that attempt to write file outside output folder, case 1, safeSymlinksOnly=true",
        );
    });

    it("extract a zip file that attempt to write file outside output folder, case 2, safeSymlinksOnly=true", async () => {
        await expectNamedErrorOrWindowsPermission(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_file_write2.zip"),
                    path.join(__dirname, "../unzips/arbitrary_file_write2"),
                    {
                        overwrite: true,
                        safeSymlinksOnly: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AF_ILLEGAL_TARGET",
            "extract a zip file that attempt to write file outside output folder, case 2, safeSymlinksOnly=true",
        );
    });

    it("extract a zip file that attempt to write file to symlink folder which is outside output folder, safeSymlinksOnly=true", async () => {
        await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/output"));
        await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
        await fs.ensureFolder(path.join(__dirname, "../unzips/arbitrary_write/tmp"));

        await allowNamedErrorOrWindowsPermission(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_write/output1.zip"),
                    path.join(__dirname, "../unzips/arbitrary_write/output"),
                    {
                        overwrite: false,
                        safeSymlinksOnly: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AF_ILLEGAL_TARGET",
        );

        await zl.extract(
            path.join(__dirname, "../unzipResources/arbitrary_write/output2.zip"),
            path.join(__dirname, "../unzips/arbitrary_write/output"),
            {
                overwrite: false,
                safeSymlinksOnly: true,
                symlinkAsFileOnWindows: false,
            },
        );

        await expectNonWindowsFailureOrAllowWindowsPermission(
            () =>
                zl.extract(
                    path.join(__dirname, "../unzipResources/arbitrary_write/output3.zip"),
                    path.join(__dirname, "../unzips/arbitrary_write/output"),
                    {
                        overwrite: false,
                        safeSymlinksOnly: true,
                        symlinkAsFileOnWindows: false,
                    },
                ),
            "AF_ILLEGAL_TARGET",
            "extract a zip file that attempt to write file to symlink folder which is outside output folder",
        );
    });
});