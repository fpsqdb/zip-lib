import fs from "node:fs";
import path from "node:path";
import rimraf from "rimraf";

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
let shouldCreateFileLink = true;
if (fs.existsSync(fileSymlinkPath)) {
    const stat = fs.lstatSync(fileSymlinkPath);
    if (!stat.isSymbolicLink()) {
        fs.unlinkSync(fileSymlinkPath);
    } else {
        shouldCreateFileLink = false;
    }
}

if (shouldCreateFileLink) {
    try {
        fs.symlinkSync("./¹ º » ¼ ½ ¾.txt", fileSymlinkPath);
    } catch (error) {
        if (process.platform === "win32" && error.code === "EPERM") {
            // On windows, the default security policy allows only administrators to create symbolic links.
            // ignore EPERM on windows
            console.warn("If you want to test symlink under windows, run the test with administrator privileges.");
        } else {
            throw error;
        }
    }
}

const folderSymlinkPath = path.join(__dirname, "../resources/subfolder_symlink");
let shouldCreateFolderLink = true;
if (fs.existsSync(folderSymlinkPath)) {
    const stat = fs.lstatSync(folderSymlinkPath);
    if (!stat.isSymbolicLink()) {
        rimraf.sync(folderSymlinkPath);
    } else {
        shouldCreateFolderLink = false;
    }
}

if (shouldCreateFolderLink) {
    try {
        fs.symlinkSync("./subfolder", folderSymlinkPath, "dir");
    } catch (error) {
        if (process.platform === "win32" && error.code === "EPERM") {
            // On windows, the default security policy allows only administrators to create symbolic links.
            // ignore EPERM on windows
            console.warn("If you want to test symlink under windows, run the test with administrator privileges.");
        } else {
            throw error;
        }
    }
}
