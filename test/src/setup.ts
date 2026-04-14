import fs from "node:fs";
import path from "node:path";
import * as rimraf from "rimraf";

function ensureSymlink(linkPath: string, target: string, type?: "dir" | "file" | "junction"): void {
    try {
        const stat = fs.lstatSync(linkPath);
        if (stat.isSymbolicLink()) {
            return;
        }
        if (stat.isDirectory()) {
            rimraf.sync(linkPath);
        } else {
            fs.unlinkSync(linkPath);
        }
    } catch (_error) {
        // ignore error
    }

    fs.symlinkSync(target, linkPath, type);
}

export function setup() {
    const folder1 = path.join(__dirname, "../resources/name with space");
    if (!fs.existsSync(folder1)) {
        fs.mkdirSync(folder1);
    }

    const subfolder1 = path.join(folder1, "/empty folder");
    if (!fs.existsSync(subfolder1)) {
        fs.mkdirSync(subfolder1);
    }

    const folder2 = path.join(__dirname, "../resources/«ταБЬℓσ»");
    if (!fs.existsSync(folder2)) {
        fs.mkdirSync(folder2);
    }

    const fileSymlinkPath = path.join(__dirname, "../resources/symlink");
    ensureSymlink(fileSymlinkPath, "./¹ º » ¼ ½ ¾.txt", "file");

    const brokenFileSymlinkPath = path.join(__dirname, "../resources_with_broken_symlink/broken_file_symlink");
    ensureSymlink(brokenFileSymlinkPath, "./not_exist_file.txt", "file");

    const folderSymlinkPath = path.join(__dirname, "../resources/subfolder_symlink");
    ensureSymlink(folderSymlinkPath, "./subfolder", "dir");

    const brokenFolderSymlinkPath = path.join(__dirname, "../resources_with_broken_symlink/broken_folder_symlink");
    ensureSymlink(brokenFolderSymlinkPath, "./not_exist_folder", "dir");

    const brokenFolderSymlinkPath2 = path.join(__dirname, "../resources_with_broken_symlink/broken_folder_symlink2");
    ensureSymlink(brokenFolderSymlinkPath2, "./not_exist_folder/", "dir");
}
