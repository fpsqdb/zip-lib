const fs = require("fs");
const path = require("path");

const folder1 = path.join(__dirname, "../resources/name with space")
if (!fs.existsSync(folder1)) {
    fs.mkdirSync(folder1);
}

const subfolder1 = path.join(folder1, "/empty folder")
if (!fs.existsSync(subfolder1)) {
    fs.mkdirSync(subfolder1);
}

const folder2 = path.join(__dirname, "../resources/«ταБЬℓσ»")
if (!fs.existsSync(folder2)) {
    fs.mkdirSync(folder2);
}

const symlinkPath = path.join(__dirname, "../resources/symlink");
let shouldCreate = true;
if (fs.existsSync(symlinkPath)) {
    const stat = fs.lstatSync(symlinkPath);
    if (!stat.isSymbolicLink()) {
        fs.unlinkSync(symlinkPath);
    } else {
        shouldCreate = false;
    }
}

if (shouldCreate) {
    try {
        fs.symlinkSync("./¹ º » ¼ ½ ¾.txt", symlinkPath);
    } catch (error) {
        if (process.platform === "win32" &&
            error.code === "EPERM") {
            // On windows, the default security policy allows only administrators to create symbolic links.
            // ignore EPERM on windows
            console.warn("If you want to test symlink under windows, run the test with administrator privileges.");
        } else {
            throw error;
        }
    }
}