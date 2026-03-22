import * as path from "node:path";
import { describe, expect, it, test } from "vitest";
import * as exfs from "../../src/fs";

describe("fs helper", () => {
    describe("isRootPath", () => {
        it("d", () => {
            expect(exfs.isRootPath("d")).toBe(false);
        });
        it("/", () => {
            expect(exfs.isRootPath("/")).toBe(true);
        });
        it("\\", () => {
            expect(exfs.isRootPath("\\")).toBe(true);
        });
        it("\\test", () => {
            expect(exfs.isRootPath("\\test")).toBe(false);
        });
        it("/test", () => {
            expect(exfs.isRootPath("/test")).toBe(false);
        });
        it("d:", () => {
            expect(exfs.isRootPath("d:")).toBe(process.platform === "win32");
        });
        it("D:", () => {
            expect(exfs.isRootPath("D:")).toBe(process.platform === "win32");
        });
        it("d:/", () => {
            expect(exfs.isRootPath("d:/")).toBe(process.platform === "win32");
        });
        it("D:/", () => {
            expect(exfs.isRootPath("D:/")).toBe(process.platform === "win32");
        });
        it("D:/test", () => {
            expect(exfs.isRootPath("D:/test")).toBe(false);
        });
        it("dd:", () => {
            expect(exfs.isRootPath("dd:")).toBe(false);
        });
    });

    describe("pathExists", () => {
        const target1 = path.join(__dirname, "../resources");
        it(target1, async () => {
            const exist = await exfs.pathExists(target1);
            expect(exist).toBe(true);
        });
        const target2 = path.join(__dirname, "../asdfasdfa");
        it(target2, async () => {
            const exist = await exfs.pathExists(target2);
            expect(exist).toBe(false);
        });
        const target3 = path.join(__dirname, "../resources/¹ º » ¼ ½ ¾.txt");
        it(target3, async () => {
            const exist = await exfs.pathExists(target3);
            expect(exist).toBe(true);
        });
    });

    describe("readdirp", () => {
        const target1 = path.join(__dirname, "../resources");
        it(target1, async () => {
            const files = await exfs.readdirp(target1);
            const fileSymlinkExist = await exfs.pathExists(path.join(target1, "symlink"));
            const folderSymlinkExist = await exfs.pathExists(path.join(target1, "subfolder_symlink"));
            const expectedFiles: string[] = [];
            expectedFiles.push(path.join(target1, "«ταБЬℓσ»"));
            expectedFiles.push(path.join(target1, "name with space/empty folder"));
            expectedFiles.push(path.join(target1, "subfolder/test text.txt"));
            expectedFiles.push(path.join(target1, "subfolder/test.txt"));
            expectedFiles.push(path.join(target1, "subfolder/test.txt - shortcut.lnk"));
            expectedFiles.push(path.join(target1, "¹ º » ¼ ½ ¾.txt"));
            expectedFiles.push(path.join(target1, "src - shortcut.lnk"));
            if (fileSymlinkExist && !folderSymlinkExist) {
                expectedFiles.push(path.join(target1, "symlink"));
                expect(files).toHaveLength(8);
            } else if (!fileSymlinkExist && folderSymlinkExist) {
                expectedFiles.push(path.join(target1, "subfolder_symlink"));
                expect(files).toHaveLength(8);
            } else if (!fileSymlinkExist && !folderSymlinkExist) {
                expect(files).toHaveLength(7);
            } else if (fileSymlinkExist && folderSymlinkExist) {
                expectedFiles.push(path.join(target1, "symlink"));
                expectedFiles.push(path.join(target1, "subfolder_symlink"));
                expect(files).toHaveLength(9);
            }
            files.forEach((item) => {
                expect(expectedFiles).toContain(item.path);
            });
        });
    });

    describe("ensureFolder", () => {
        const target1 = path.join(__dirname, "../unzips/test/sub folder/sub");
        it(target1, async () => {
            await exfs.ensureFolder(target1);
            const exist = await exfs.pathExists(target1);
            expect(exist).toBe(true);
        });
        const target2 = "/";
        it(target2, async () => {
            const rootExist = await exfs.pathExists(target2);
            await exfs.ensureFolder(target2);
            const exist = await exfs.pathExists(target2);
            expect(exist).toBe(rootExist);
        });
        if (process.platform === "win32") {
            const target3 = "D:";
            it(target3, async () => {
                const rootExist = await exfs.pathExists(target3);
                await exfs.ensureFolder(target3);
                const exist = await exfs.pathExists(target3);
                expect(exist).toBe(rootExist);
            });
            const target4 = "E:/";
            it(target4, async () => {
                const rootExist = await exfs.pathExists(target4);
                await exfs.ensureFolder(target4);
                const exist = await exfs.pathExists(target4);
                expect(exist).toBe(rootExist);
            });
            const target5 = "z:";
            it(target5, async () => {
                const rootExist = await exfs.pathExists(target5);
                await exfs.ensureFolder(target5);
                const exist = await exfs.pathExists(target5);
                expect(exist).toBe(rootExist);
            });
        }
        const target6 = path.join(__dirname, "../unzips/test/sub folder/test:");
        it(target6, async () => {
            try {
                await exfs.ensureFolder(target6);
                const exist = await exfs.pathExists(target6);
                if (process.platform === "win32") {
                    throw new Error(`"${target6}" should be an invalid name on windows`);
                }
                expect(exist).toBe(true);
            } catch (error) {
                if (process.platform !== "win32") {
                    throw error;
                }
            }
        });
    });

    describe("rimraf", () => {
        const target1 = path.join(__dirname, "../unzips/test2/sub folder/sub");
        it(target1, async () => {
            await exfs.ensureFolder(target1);
            const target1Root = path.join(__dirname, "../unzips/test2");
            await exfs.rimraf(target1Root);
            const exist = await exfs.pathExists(target1Root);
            expect(exist).toBe(false);
        });
        const target2 = path.join(__dirname, "../unzips/test3/sub folder/sub");
        it(target2, async () => {
            await exfs.rimraf(target2);
            const exist = await exfs.pathExists(target2);
            expect(exist).toBe(false);
        });
        const target3 = "z:";
        it(target3, async () => {
            if (process.platform === "win32") {
                await expect(exfs.rimraf(target3)).rejects.toThrow(`Refuse to recursively delete root, path: "${target3}"`);
                return;
            }
            await exfs.rimraf(target3);
        });
    });

    describe("isOutside", () => {
        const baseDir = path.resolve("test-root");

        test("should return false for the exact same directory", () => {
            expect(exfs.isOutside(baseDir, baseDir)).toBe(false);
        });

        test("should return false for a file or subfolder deep inside", () => {
            const insidePath = path.join(baseDir, "subdir", "deep", "file.txt");
            expect(exfs.isOutside(baseDir, insidePath)).toBe(false);
        });

        test("should return true for a path that uses .. to climb out", () => {
            const outsidePath = path.join(baseDir, "..", "external_file.txt");
            expect(exfs.isOutside(baseDir, outsidePath)).toBe(true);
        });

        test("should return false for .. that resolves back to inside the base", () => {
            const safePath = path.join(baseDir, "sub", "..", "file.txt");
            expect(exfs.isOutside(baseDir, safePath)).toBe(false);
        });

        test("should return true for absolute system paths", () => {
            const systemPath = process.platform === "win32" ? "C:\\Windows" : "/etc/passwd";
            expect(exfs.isOutside(baseDir, systemPath)).toBe(true);
        });

        if (process.platform === "win32") {
            test("Windows: should return true for different drive letters", () => {
                const baseOnC = "C:\\App";
                const targetOnD = "D:\\Data";
                expect(exfs.isOutside(baseOnC, targetOnD)).toBe(true);
            });
            test("Windows: should return false for same drive letters", () => {
                const baseOnC = "C:\\App";
                const targetOnC = "C:\\App\\Data";
                expect(exfs.isOutside(baseOnC, targetOnC)).toBe(false);
            });
        }

        test("should handle relative paths correctly by resolving them first", () => {
            expect(exfs.isOutside(".", "..")).toBe(true);
        });
    });
});