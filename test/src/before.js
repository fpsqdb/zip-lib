const fs = require("fs");
const path = require("path");

const folder1 = path.join(__dirname, "../resources/name with space")
if(!fs.existsSync(folder1)){
    fs.mkdirSync(folder1);
}

const subfolder1 = path.join(folder1, "/empty folder")
if(!fs.existsSync(subfolder1)){
    fs.mkdirSync(subfolder1);
}

const folder2 = path.join(__dirname, "../resources/«ταБЬℓσ»")
if(!fs.existsSync(folder2)){
    fs.mkdirSync(folder2);
}