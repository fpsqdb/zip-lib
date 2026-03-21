import * as assert from "node:assert";
import * as path from "node:path";
import { describe, it } from "vitest";
import * as zl from "../../src";
import * as fs from "../../src/fs";

describe("unzip, safeSymlinksOnly=false", () => {
    it("extract a zip file that attempt to write file outside output folder, case 1", async () => {
        try {
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_file_write.zip"),
                path.join(__dirname, "../unzips/arbitrary_file_write"),
                {
                    overwrite: true,
                    symlinkAsFileOnWindows: false,
                },
            );
            assert.fail("extract a zip file that attempt to write file outside output folder");
        } catch (error) {
            if (process.platform === "win32" && error.code === "EPERM") {
                console.warn("Please run this test with administrator.");
                assert.ok(true, "Please run this test with administrator.");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }
    });
    it("extract a zip file that attempt to write file outside output folder, case 2", async () => {
        try {
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_file_write2.zip"),
                path.join(__dirname, "../unzips/arbitrary_file_write2"),
                {
                    overwrite: true,
                    symlinkAsFileOnWindows: false,
                },
            );
            assert.fail("extract a zip file that attempt to write file outside output folder");
        } catch (error) {
            if (process.platform === "win32" && error.code === "EPERM") {
                console.warn("Please run this test with administrator.");
                assert.ok(true, "Please run this test with administrator.");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }
    });
    it("extract a zip file that attempt to write file to symlink folder which is outside output folder", async () => {
        try {
            await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/output"));
            await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
            await fs.ensureFolder(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_write/output1.zip"),
                path.join(__dirname, "../unzips/arbitrary_write/output"),
                {
                    overwrite: false,
                    symlinkAsFileOnWindows: false,
                },
            );
        } catch (error) {
            if (process.platform === "win32" && error.code === "EPERM") {
                console.warn("Please run this test with administrator.");
                assert.ok(true, "Please run this test with administrator.");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }

        try {
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_write/output2.zip"),
                path.join(__dirname, "../unzips/arbitrary_write/output"),
                {
                    overwrite: false,
                    symlinkAsFileOnWindows: false,
                },
            );
            if (process.platform === "win32") {
                assert.ok(true, "Please run this test with administrator.");
            } else {
                assert.fail(
                    "extract a zip file that attempt to write file to symlink folder which is outside output folder",
                );
            }
        } catch (error) {
            if (process.platform === "win32" && error.code === "EPERM") {
                assert.ok(true, "Please run this test with administrator.");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }

        try {
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_write/output3.zip"),
                path.join(__dirname, "../unzips/arbitrary_write/output"),
                {
                    overwrite: false,
                    symlinkAsFileOnWindows: false,
                },
            );
            if (process.platform === "win32") {
                assert.ok(true, "Please run this test with administrator.");
            } else {
                assert.fail(
                    "extract a zip file that attempt to write file to symlink folder which is outside output folder",
                );
            }
        } catch (error) {
            if (process.platform === "win32" && error.code === "EPERM") {
                assert.ok(true, "Please run this test with administrator.");
            } else if (error.name === "AFWRITE") {
                assert.ok(true, "name AFWRITE as expected");
            } else {
                assert.fail(error);
            }
        }
    });
});

describe("unzip, safeSymlinksOnly=true", () => {
    it("extract a zip file that attempt to write file outside output folder, case 1, safeSymlinksOnly=true", async () => {
        try {
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_file_write.zip"),
                path.join(__dirname, "../unzips/arbitrary_file_write"),
                {
                    overwrite: true,
                    safeSymlinksOnly: true,
                    symlinkAsFileOnWindows: false,
                },
            );
            assert.fail("extract a zip file that attempt to write file outside output folder");
        } catch (error) {
            if (process.platform === "win32" && error.code === "EPERM") {
                console.warn("Please run this test with administrator.");
                assert.ok(true, "Please run this test with administrator.");
            } else if (error.name === "AF_ILLEGAL_TARGET") {
                assert.ok(true, "name AF_ILLEGAL_TARGET as expected");
            } else {
                assert.fail(error);
            }
        }
    });
    it("extract a zip file that attempt to write file outside output folder, case 2, safeSymlinksOnly=true", async () => {
        try {
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_file_write2.zip"),
                path.join(__dirname, "../unzips/arbitrary_file_write2"),
                {
                    overwrite: true,
                    safeSymlinksOnly: true,
                    symlinkAsFileOnWindows: false,
                },
            );
            assert.fail("extract a zip file that attempt to write file outside output folder");
        } catch (error) {
            if (process.platform === "win32" && error.code === "EPERM") {
                console.warn("Please run this test with administrator.");
                assert.ok(true, "Please run this test with administrator.");
            } else if (error.name === "AF_ILLEGAL_TARGET") {
                assert.ok(true, "name AF_ILLEGAL_TARGET as expected");
            } else {
                assert.fail(error);
            }
        }
    });
    it("extract a zip file that attempt to write file to symlink folder which is outside output folder, safeSymlinksOnly=true", async () => {
        try {
            await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/output"));
            await fs.rimraf(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
            await fs.ensureFolder(path.join(__dirname, "../unzips/arbitrary_write/tmp"));
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_write/output1.zip"),
                path.join(__dirname, "../unzips/arbitrary_write/output"),
                {
                    overwrite: false,
                    safeSymlinksOnly: true,
                    symlinkAsFileOnWindows: false,
                },
            );
        } catch (error) {
            if (process.platform === "win32" && error.code === "EPERM") {
                console.warn("Please run this test with administrator.");
                assert.ok(true, "Please run this test with administrator.");
            } else if (error.name === "AF_ILLEGAL_TARGET") {
                assert.ok(true, "name AF_ILLEGAL_TARGET as expected");
            } else {
                assert.fail(error);
            }
        }

        try {
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_write/output2.zip"),
                path.join(__dirname, "../unzips/arbitrary_write/output"),
                {
                    overwrite: false,
                    safeSymlinksOnly: true,
                    symlinkAsFileOnWindows: false,
                },
            );
            assert.ok("extract a zip file that attempt to write file to symlink folder which is outside output folder");
        } catch (error) {
            assert.fail(error);
        }

        try {
            await zl.extract(
                path.join(__dirname, "../unzipResources/arbitrary_write/output3.zip"),
                path.join(__dirname, "../unzips/arbitrary_write/output"),
                {
                    overwrite: false,
                    safeSymlinksOnly: true,
                    symlinkAsFileOnWindows: false,
                },
            );
            if (process.platform === "win32") {
                assert.ok(true, "Please run this test with administrator.");
            } else {
                assert.fail(
                    "extract a zip file that attempt to write file to symlink folder which is outside output folder",
                );
            }
        } catch (error) {
            if (process.platform === "win32" && error.code === "EPERM") {
                assert.ok(true, "Please run this test with administrator.");
            } else if (error.name === "AF_ILLEGAL_TARGET") {
                assert.ok(true, "name AF_ILLEGAL_TARGET as expected");
            } else {
                assert.fail(error);
            }
        }
    });
});
