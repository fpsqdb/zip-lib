import * as path from "path";
import * as util from "./util";

export interface FileEntry {
    path: string;
    type: FileType;
    mtime: Date;
    mode: number;
}
export type FileType = "symlink" | "file" | "dir";

export async function readdirp(folder: string): Promise<FileEntry[]> {
    let result: FileEntry[] = [];
    const files = await util.readdir(folder);
    for (let i = 0; i < files.length; i++) {
        const file = path.join(folder, files[i]);
        const stat = await util.lstat(file);
        let fileType: FileType = "file";
        if (stat.isDirectory()) {
            fileType = "dir";
            const subFiles = await readdirp(file);
            if (subFiles.length > 0) {
                result.push(...subFiles);
                // If the folder is not empty, don't need to add the folder itself.
                // continue and skip the code below
                continue;
            }
        } else {
            if (stat.isSymbolicLink()) {
                fileType = "symlink";
            }
        }
        result.push({
            path: file,
            type: fileType,
            mtime: stat.mtime,
            mode: stat.mode
        });
    }
    return result;
}

export async function ensureFolder(folder: string): Promise<void> {
    // stop at root
    if (folder === path.dirname(folder)) {
        return Promise.resolve();
    }
    try {
        await mkdir(folder);
    } catch (error) {
        // ENOENT: a parent folder does not exist yet, continue
        // to create the parent folder and then try again.
        if (error.code === "ENOENT") {
            await ensureFolder(path.dirname(folder));
            return mkdir(folder);
        }
        // Any other error
        return Promise.reject(error);
    }
}

export async function pathExists(path: string): Promise<boolean> {
    try {
        await util.access(path);
        return true;
    }
    catch (error) {
        return false;
    }
}

export async function rimraf(target: string): Promise<void> {
    if (isRootPath(target)) {
        // refuse to recursively delete root
        return Promise.reject(new Error(`Refuse to recursively delete root, path: "${target}"`));
    }
    try {
        const stat = await util.lstat(target);
        // Folder delete (recursive) - NOT for symbolic links though!
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
            // Children
            const children = await util.readdir(target);
            await Promise.all(children.map(child => rimraf(path.join(target, child))));
            // Folder
            await util.rmdir(target);
        }
        // Single file delete
        else {
            // chmod as needed to allow for unlink
            const mode = stat.mode;
            if (!(mode & 128)) { // 128 === 0200
                await util.chmod(target, mode | 128);
            }
            return util.unlink(target);
        }
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
}

async function mkdir(folder: string): Promise<void> {
    try {
        await util.mkdir(folder, 0o777);
    } catch (error) {
        // ENOENT: a parent folder does not exist yet
        if (error.code === "ENOENT") {
            return Promise.reject(error);
        }
        // Any other error: check if folder exists and
        // return normally in that case if its a folder
        try {
            const fileStat = await util.lstat(folder);
            if (!fileStat.isDirectory()) {
                return Promise.reject(new Error(`"${folder}" exists and is not a directory.`));
            }
        } catch (statError) {
            throw error; // rethrow original error
        }
    }
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
const cahrUnixSep: number = 47;
function isDriveLetter(char0: number): boolean {
    return char0 >= charA && char0 <= charZ || char0 >= chara && char0 <= charz;
}
const winSep: string = "\\";
const unixSep: string = "/";
export function isRootPath(path: string): boolean {
    if (!path) {
        return false;
    }
    if (path === winSep ||
        path === unixSep) {
        return true;
    }
    if (process.platform === "win32") {
        if (path.length > 3) {
            return false;
        }
        return isDriveLetter(path.charCodeAt(0))
            && path.charCodeAt(1) === charColon
            && (path.length === 2 || path.charCodeAt(2) === charWinSep || path.charCodeAt(2) === cahrUnixSep);
    }
    return false;
}