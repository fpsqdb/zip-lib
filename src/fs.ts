import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as util from "node:util";

export interface FileEntry {
    path: string;
    isSymbolicLink: boolean;
    type: FileType;
    mtime: Date;
    mode: number;
}
export type FolderStat =
    | {
          isDirectory: true;
          isSymbolicLink: false;
      }
    | {
          isDirectory: false;
          isSymbolicLink: true;
          realpath: string;
      };
export type FileType = "file" | "dir";

/**
 * Checks if the target path is outside the specified base directory.
 *
 * @param basePath - The reference directory.
 * @param targetPath - The path to evaluate against the base.
 * @returns `true` if targetPath is outside of basePath.
 */
export function isOutside(basePath: string, targetPath: string): boolean {
    const absoluteBase = path.resolve(basePath);
    const absoluteTarget = path.resolve(targetPath);

    const relative = path.relative(absoluteBase, absoluteTarget);

    return relative.startsWith("..") || path.isAbsolute(relative);
}

export async function realpath(target: string): Promise<string> {
    // fs.promises.realpath has a bug with long path on Windows.
    // https://github.com/nodejs/node/issues/51031
    return util.promisify(fsSync.realpath)(target);
}

export async function readdirp(folder: string): Promise<FileEntry[]> {
    const result: FileEntry[] = [];
    const filePaths = (await fs.readdir(folder)).map((item) => path.join(folder, item));
    const entries = await Promise.all(filePaths.map((filePath) => getFileEntry(filePath)));

    for (const entry of entries) {
        if (!entry.isSymbolicLink && entry.type === "dir") {
            const subFiles = await readdirp(entry.path);
            if (subFiles.length > 0) {
                result.push(...subFiles);
                // If the folder is not empty, don't need to add the folder itself.
                continue;
            }
        }
        result.push(entry);
    }
    return result;
}

export async function getFileEntry(target: string): Promise<FileEntry> {
    const stat = await fs.lstat(target);
    if (stat.isDirectory()) {
        return {
            path: target,
            isSymbolicLink: false,
            type: "dir",
            mtime: stat.mtime,
            mode: stat.mode,
        };
    }

    if (!stat.isSymbolicLink()) {
        return {
            path: target,
            isSymbolicLink: false,
            type: "file",
            mtime: stat.mtime,
            mode: stat.mode,
        };
    }

    // If the path is a link, we must instead use fs.stat() to find out if the
    // link is a directory or not because lstat will always return the stat of
    // the link which is always a file.
    const actualStat = await fs.stat(target);
    return {
        path: target,
        isSymbolicLink: true,
        type: actualStat.isDirectory() ? "dir" : "file",
        mtime: stat.mtime,
        mode: stat.mode,
    };
}

export async function ensureFolder(folder: string): Promise<FolderStat> {
    // stop at root
    if (folder === path.dirname(folder)) {
        return {
            isDirectory: true,
            isSymbolicLink: false,
        };
    }
    try {
        return await mkdir(folder);
    } catch (error) {
        // ENOENT: a parent folder does not exist yet, continue
        // to create the parent folder and then try again.
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
            await ensureFolder(path.dirname(folder));
            return await mkdir(folder);
        }
        // Any other error
        throw error;
    }
}

export async function pathExists(target: string): Promise<boolean> {
    try {
        await fs.access(target);
        return true;
    } catch (_error) {
        return false;
    }
}

export async function statFolder(folder: string): Promise<FolderStat | undefined> {
    try {
        return await statExistingFolder(folder);
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}

export async function rimraf(target: string): Promise<void> {
    if (isRootPath(target)) {
        // refuse to recursively delete root
        throw new Error(`Refuse to recursively delete root, path: "${target}"`);
    }
    try {
        const stat = await fs.lstat(target);
        // Folder delete (recursive) - NOT for symbolic links though!
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
            // Children
            const children = await fs.readdir(target);
            await Promise.all(children.map((child) => rimraf(path.join(target, child))));
            // Folder
            await fs.rmdir(target);
            return;
        }

        // Single file delete
        const mode = stat.mode;
        if (!(mode & 128)) {
            // 128 === 0200
            await fs.chmod(target, mode | 128);
        }
        await fs.unlink(target);
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code !== "ENOENT") {
            throw error;
        }
    }
}

async function mkdir(folder: string): Promise<FolderStat> {
    try {
        await fs.mkdir(folder, 0o777);
        return {
            isDirectory: true,
            isSymbolicLink: false,
        };
    } catch (error) {
        // ENOENT: a parent folder does not exist yet or folder name is invalid.
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
            throw error;
        }
        // Any other error: check if folder exists and
        // return normally in that case if its a folder
        try {
            return await statExistingFolder(folder);
        } catch (_statError) {
            throw error; // rethrow original error
        }
    }
}

async function statExistingFolder(folder: string): Promise<FolderStat> {
    const fileStat = await fs.lstat(folder);
    if (!fileStat.isSymbolicLink()) {
        if (!fileStat.isDirectory()) {
            throw new Error(`"${folder}" exists and is not a directory.`);
        }
        return {
            isDirectory: true,
            isSymbolicLink: false,
        };
    }

    const realFilePath = await realpath(folder);
    const realFileStat = await fs.lstat(realFilePath);
    if (!realFileStat.isDirectory()) {
        throw new Error(`"${folder}" exists and is not a directory.`);
    }
    return {
        isDirectory: false,
        isSymbolicLink: true,
        realpath: realFilePath,
    };
}

// "A"
const charA: number = 65;
// "Z"
const charZ: number = 90;
// "a"
const chara: number = 97;
// "z"
const charz: number = 122;
// ":"
const charColon: number = 58;
// "\"
const charWinSep: number = 92;
// "/"
const charUnixSep: number = 47;
function isDriveLetter(char0: number): boolean {
    return (char0 >= charA && char0 <= charZ) || (char0 >= chara && char0 <= charz);
}
const winSep: string = "\\";
const unixSep: string = "/";
export function isRootPath(target: string): boolean {
    if (!target) {
        return false;
    }
    if (target === winSep || target === unixSep) {
        return true;
    }
    if (process.platform === "win32") {
        if (target.length > 3) {
            return false;
        }
        return (
            isDriveLetter(target.charCodeAt(0)) &&
            target.charCodeAt(1) === charColon &&
            (target.length === 2 || target.charCodeAt(2) === charWinSep || target.charCodeAt(2) === charUnixSep)
        );
    }
    return false;
}
