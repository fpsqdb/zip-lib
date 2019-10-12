# zip-lib 
zip and unzip library for node. 

## Install

```
npm install zip-lib
```

## Quick Start

* [Zip](#Zip)
    - [Zip single file](#zip-single-file)
    - [Zip single folder](#zip-single-folder)
* [Unzip](#unzip)
* [Advanced usage](#advance-usage)
    - [Zip multiple files and folders](#zip-multiple-files-and-folders)
    - [Zip with metadata](#zip-with-metadata)
    - [Unzip with entry callback](#unzip-with-entry-callback)
    - [Cancel zip](#cancel-zip)
    - [Cancel unzip](#cancel-unzip)  
* [API](#api)
    - Method: [archiveFile](#archivefile)
    - Method: [archiveFolder](#archivefolder)
    - Method: [extract](#extract)
    - Class: [Zip](#class-zip)
    - Class: [Unzip](#class-unzip)
    - Options: [IZipOptions](#izipoptions)
    - Options: [IExtractOptions](#iextractoptions)

## Zip
You can use **zip-lib** to compress files or folders.

### Zip single file

```js
var zl = require("zip-lib");

zl.archiveFile("path/to/file.txt", "path/to/target.zip").then(function () {
    console.log("done");
}, function (err) {
    console.log(err);
});
```

### Zip single folder

```js
var zl = require("zip-lib");

zl.archiveFolder("path/to/folder", "path/to/target.zip").then(function () {
    console.log("done");
}, function (err) {
    console.log(err);
});
```

## Unzip

```js
var zl = require("zip-lib");

zl.extract("path/to/target.zip", "path/to/target").then(function () {
    console.log("done");
}, function (err) {
    console.log(err);
});
```

## Advanced usage

### Zip multiple files and folders

```js
var zl = require("zip-lib");

var zip = new zl.Zip();
// Adds a file from the file system
zip.addFile("path/to/file.txt");
// Adds a folder from the file system, putting its contents at the root of archive
zip.addFolder("path/to/folder");
// Generate zip file.
zip.archive("path/to/target.zip").then(function () {
    console.log("done");
}, function (err) {
    console.log(err);
});
```

The `path/to/folder` directory is as follows:

```
path/to/folder
.
├── dir1
│   ├── file.ext
├── dir2
└── file_in_root.ext
```

And the generated `path/to/target.zip` archive file directory will be as follows:

```
path/to/target.zip
.
├── file.txt
├── dir1
│   ├── file.ext
├── dir2
└── file_in_root.ext
```

### Zip with metadata

```js
var zl = require("zip-lib");

var zip = new zl.Zip();
// Adds a file from the file system
zip.addFile("path/to/file.txt", "renamedFile.txt");
zip.addFile("path/to/file2.txt", "folder/file.txt");
// Adds a folder from the file system, and naming it `new folder` within the archive
zip.addFolder("path/to/folder", "new folder");
// Generate zip file.
zip.archive("path/to/target.zip").then(function () {
    console.log("done");
}, function (err) {
    console.log(err);
});
```

The `path/to/folder` directory is as follows:

```
path/to/folder
.
├── dir1
│   ├── file.ext
├── dir2
└── file_in_root.ext
```

And the generated `path/to/target.zip` archive file directory will be as follows:

```
path/to/target.zip
.
├── renamedFile.txt
├── folder
│   ├── file.txt
│── new folder
    ├── dir1
    │   ├── file.ext
    ├── dir2
    └── file_in_root.ext
```

### Unzip with entry callback

```js
var zl = require("zip-lib");

var unzip = new zl.Unzip({
    // Called before an item is extracted.
    // entryName: Entry name.
    // entryCount: Total number of entries.
    onEntry: function (entryName, entryCount) {
        console.log(entryCount, entryName);
    }
})
unzip.extract("path/to/target.zip", "path/to/target").then(function () {
    console.log("done");
}, function (err) {
    console.log(err);
});
```

### Cancel zip
If the `cancel` method is called after the archive is complete, nothing will happen.

```js
var zl = require("zip-lib");

var zip = new zl.Zip();
zip.addFile("path/to/file.txt");
zip.archive("path/to/target.zip").then(function () {
    console.log("done");
}, function (err) {
    if (err.name === "Canceled") {
        console.log("cancel");
    } else {
        console.log(err);
    }
});

// Cancel zip
zip.cancel();
```

### Cancel unzip
If the `cancel` method is called after the extract is complete, nothing will happen.

```js
var zl = require("zip-lib");

var unzip = new zl.Unzip();
unzip.extract("path/to/target.zip", "path/to/target").then(function () {
    console.log("done");
}, function (err) {
    if (err.name === "Canceled") {
        console.log("cancel");
    } else {
        console.log(err);
    }
});

// cancel
unzip.cancel();
```

## API

### Method: archiveFile <a id="archivefile"></a>

**archiveFile(file, zipFile, [options])**

Compress a single file to zip.

- `file`: String
- `zipFile`: String
- `options?`: [IZipOptions](#izipoptions) (optional)

Returns: `Promise<viod>`

### Method: archiveFolder <a id="archivefolder"></a>

**archiveFolder(folder, zipFile, [options])**

Compress all the contents of the specified folder to zip.

- `folder`: String
- `zipFile`: String
- `options?`: [IZipOptions](#izipoptions) (optional)

Returns: `Promise<void>`

### Method: extract <a id="extract"></a>

**extract(zipFile, targetFolder, [options])**

Extract the zip file to the specified location.

- `zipFile`: String
- `targetFolder`: String
- `options?`: [IExtractOptions](#iextractoptions) (optional)

Returns: `Promise<void>`

### Class: Zip<a id="class-zip"></a>
Compress files or folders to a zip file.

**Constructor: new Zip([options])**

- `options?`: [IZipOptions](#izipoptions) 

**Method: addFile(file, [metadataPath])**

Adds a file from the file system at realPath into the zipfile as metadataPath.

- `file`: String
- `metadataPath?`: String (optional) - Typically metadataPath would be calculated as path.relative(root, realPath). A valid metadataPath must not start with `/` or `/[A-Za-z]:\//`, and must not contain `..`.

Returns: `void`

**Method: addFolder(folder, [metadataPath])**

Adds a folder from the file system at realPath into the zipfile as metadataPath.

- `folder`: String
- `metadataPath?`: String (optional) - Typically metadataPath would be calculated as path.relative(root, realPath). A valid metadataPath must not start with `/` or `/[A-Za-z]:\//`, and must not contain `..`.

Returns: `void`

**Method: archive(zipFile)**

Generate zip file.

- `zipFile`: String

Returns: `Promise<viod>`

**Method: cancel()**

Cancel compression. If the `cancel` method is called after the archive is complete, nothing will happen.

Returns: `void`

### Class: Unzip<a id="class-unzip"></a>
Extract the zip file.

**Constructor: new Unzip([options])**

- `options?`: [IZipOptions](#izipoptions) (optional)

**Method: extract(zipFile, targetFolder)**

Extract the zip file to the specified location.

- `zipFile`: String
- `targetFolder`: String

Returns: `Promise<void>`

**Method: cancel()**

If the `cancel` method is called after the extract is complete, nothing will happen.

Returns: `void`

### Options: IZipOptions <a id="izipoptions"></a>

Object
- `overwrite?`: String (optional) - If it is true, the target file will be deleted before archive. The default value is `false`.
- `storeSymlinkAsFile?`: Boolean (optional) - Store symbolic links as files. The default value is `false`.

### Options: IExtractOptions <a id="iextractoptions"></a>

Object
- `overwrite?`: String (optional) - If it is true, the target directory will be deleted before extract. The default value is `false`.
- `symlinkAsFileOnWindows?`: Boolean (optional) - Extract symbolic links as files on windows. The default value is `true`. On windows, the default security policy allows only administrators to create symbolic links. <br>When `symlinkAsFileOnWindows` is set to `true`, the symlink in the zip archive will be extracted as a normal file on Windows. When `symlinkAsFileOnWindows` is set to `false`, if the zip contains symlink, an `EPERM` error will be thrown under non-administrators.
- `onEntry?`: Function (optional) - Called before an item is extracted.<br>Arguments:
    - `entryName`: String - Entry name.
    - `entryCount`: Number - Total number of entries.

# License
Licensed under the [MIT](https://github.com/fpsqdb/zip-lib/blob/master/LICENSE) license.