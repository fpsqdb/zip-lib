import * as path from "node:path";
import { describe, it } from "vitest";
import * as zl from "../../src";
import * as fs from "../../src/fs";
import {
    allowWindowsSymlinkPermissionError,
    expectNamedErrorOrWindowsPermission,
    expectNonWindowsFailureOrAllowWindowsPermission,
} from "./helpers";

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

        await allowWindowsSymlinkPermissionError(() =>
            zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_write/output1.zip"),
                path.join(__dirname, "../unzips/arbitrary_write/output"),
                {
                    overwrite: false,
                    symlinkAsFileOnWindows: false,
                },
            ),
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

        await expectNonWindowsFailureOrAllowWindowsPermission(
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
            "extract a zip file that attempt to write file to symlink folder which is outside output folder",
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
