# zip-lib
zip and unzip library for node.

[![npm Package](https://img.shields.io/npm/v/zip-lib.svg)](https://www.npmjs.org/package/zip-lib)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/fpsqdb/zip-lib/blob/master/LICENSE)
![node](https://img.shields.io/node/v/zip-lib)
[![Build Status](https://img.shields.io/github/actions/workflow/status/fpsqdb/zip-lib/test.yml?branch=master)](https://github.com/fpsqdb/zip-lib/actions?query=workflow%3Atest)

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
    - [Sets the compression level](#sets-the-compression-level)
    - [Zip multiple files and folders](#zip-multiple-files-and-folders)
    - [Zip with metadata](#zip-with-metadata)
    - [Unzip with entry callback](#unzip-with-entry-callback)
    - [Unzip and exclude specified entries](#unzip-and-exclude-specified-entries)
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

```ts
import * as zl from "zip-lib";

async function zipToFile() {
	try {
		await zl.archiveFile("path/to/file.txt", "path/to/target.zip");
		console.log("done");
	} catch (error) {
		console.error(error);
	}
}

async function zipToBuffer() {
	try {
		const buffer = await zl.archiveFile("path/to/file.txt");
		console.log("done", buffer.byteLength);
	} catch (error) {
		console.error(error);
	}
}
```

### Zip single folder

```ts
import * as zl from "zip-lib";

async function zipToFile() {
	try {
		await zl.archiveFolder("path/to/folder", "path/to/target.zip");
		console.log("done");
	} catch (error) {
		console.error(error);
	}
}

async function zipToBuffer() {
	try {
		const buffer = await zl.archiveFolder("path/to/folder");
		console.log("done", buffer.byteLength);
	} catch (error) {
		console.error(error);
	}
}
```

## Unzip

```ts
import * as zl from "zip-lib";

async function unzipFromFile() {
	try {
		await zl.extract("path/to/target.zip", "path/to/target");
		console.log("done");
	} catch (error) {
		console.error(error);
	}
}

async function unzipFromBuffer(zipBuffer: Buffer) {
	try {
		await zl.extract(zipBuffer, "path/to/target");
		console.log("done");
	} catch (error) {
		console.error(error);
	}
}
```

## Advanced usage

### Sets the compression level

```ts
import * as zl from "zip-lib";

async function zipToFile() {
	try {
		await zl.archiveFolder("path/to/folder", "path/to/target.zip", {
			compressionLevel: 9,
		});
		console.log("done");
	} catch (error) {
		console.error(error);
	}
}
```

### Zip multiple files and folders

```ts
import * as zl from "zip-lib";

async function zipToFile() {
	try {
		const zip = new zl.Zip();
		// Adds a file from the file system
		zip.addFile("path/to/file.txt");
		// Adds a folder from the file system, putting its contents at the root of archive
		zip.addFolder("path/to/folder");
		// Generate zip file.
		await zip.archive("path/to/target.zip");
		console.log("done");
	} catch (error) {
		console.error(error);
	}
}
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

```ts
import * as zl from "zip-lib";

async function zipToFile() {
	try {
		const zip = new zl.Zip();
		// Adds a file from the file system
		zip.addFile("path/to/file.txt", "renamedFile.txt");
		zip.addFile("path/to/file2.txt", "folder/file.txt");
		// Adds a folder from the file system, and naming it `new folder` within the archive
		zip.addFolder("path/to/folder", "new folder");
		// Generate zip file.
		zip.archive("path/to/target.zip");
		console.log("done");
	} catch (error) {
		console.error(error);
	}
}
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
Using `onEntry` callback we can know the current progress of extracting and control the extraction operation. See [IExtractOptions](#iextractoptions).

```ts
import * as zl from "zip-lib";

async function unzipFromFile() {
	try {
		const unzip = new zl.Unzip({
			// Called before an item is extracted.
			onEntry: (event) => {
				console.log(event.entryCount, event.entryName);
			},
		});
		await unzip.extract("path/to/target.zip", "path/to/target");
		console.log("done");
	} catch (error) {
		console.error(error);
	}
}
```

### Unzip and exclude specified entries
The following code shows how to exclude the `__MACOSX` folder in the zip file when extracting. See [IExtractOptions](#iextractoptions).

```ts
import * as zl from "zip-lib";

async function unzipFromFile() {
	try {
		const unzip = new zl.Unzip({
			// Called before an item is extracted.
			onEntry: (event) => {
				if (/^__MACOSX\//.test(event.entryName)) {
					// entry name starts with __MACOSX/
					event.preventDefault();
				}
			},
		});
		await unzip.extract("path/to/target.zip", "path/to/target");
		console.log("done");
	} catch (error) {
		console.error(error);
	}
}
```

### Cancel zip
If the `cancel` method is called after the archive is complete, nothing will happen.

```ts
import * as zl from "zip-lib";

const zip = new zl.Zip();
async function zipToFile() {
	try {
		zip.addFile("path/to/file.txt");
		await zip.archive("path/to/target.zip");
		console.log("done");
	} catch (error) {
		if (error instanceof Error && error.name === "Canceled") {
			console.log("cancel");
		} else {
			console.log(error);
		}
	}
}

function cancel() {
	zip.cancel();
}
```

### Cancel unzip
If the `cancel` method is called after the extract is complete, nothing will happen.

```ts
import * as zl from "zip-lib";

const unzip = new zl.Unzip();
async function unzipFromFile() {
	try {
		await unzip.extract("path/to/target.zip", "path/to/target");
		console.log("done");
	} catch (error) {
		if (error instanceof Error && error.name === "Canceled") {
			console.log("cancel");
		} else {
			console.log(error);
		}
	}
}

function cancel() {
	unzip.cancel();
}
```

## API

### Method: archiveFile <a id="archivefile"></a>

**archiveFile(file, zipFile, [options])**

Compress a single file to specified zip file path.

- `file`: String
- `zipFile`: String
- `options?`: [IZipOptions](#izipoptions) (optional)

Returns: `Promise<void>`

**archiveFile(file, [options])**

Compress a single file to buffer.

- `file`: String
- `options?`: [IZipOptions](#izipoptions) (optional)

Returns: `Promise<Buffer>`

### Method: archiveFolder <a id="archivefolder"></a>

**archiveFolder(folder, zipFile, [options])**

Compress all the contents of the specified folder to specified zip file path.

- `folder`: String
- `zipFile`: String
- `options?`: [IZipOptions](#izipoptions) (optional)

Returns: `Promise<void>`

**archiveFolder(folder, [options])**

Compress all the contents of the specified folder to buffer.

- `folder`: String
- `options?`: [IZipOptions](#izipoptions) (optional)

Returns: `Promise<Buffer>`

### Method: extract <a id="extract"></a>

**extract(zipFile, targetFolder, [options])**

Extract the zip file to the specified location.

- `zipFile`: String
- `targetFolder`: String
- `options?`: [IExtractOptions](#iextractoptions) (optional)

Returns: `Promise<void>`

**extract(zipBuffer, targetFolder, [options])**

Extract the zip buffer to the specified location.

- `zipBuffer`: Buffer
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

Zips the content and saves it directly to the specified file path.

- `zipFile`: String

Returns: `Promise<void>`

**Method: archive()**

Zips the content to a single buffer.

Returns: `Promise<Buffer>`

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

**Method: extract(zipBuffer, targetFolder)**

Extract the zip buffer to the specified location.

- `zipBuffer`: Buffer
- `targetFolder`: String

Returns: `Promise<void>`

**Method: cancel()**

If the `cancel` method is called after the extract is complete, nothing will happen.

Returns: `void`

### Options: IZipOptions <a id="izipoptions"></a>

Object
- `followSymlinks?`: Boolean (optional) - Indicates how to handle when the given path is a symbolic link. The default value is `false`.<br>`true`: add the target of the symbolic link to the zip.<br>`false`: add symbolic link itself to the zip.
- `compressionLevel?`: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 - Sets the compression level. The default value is `6`.<br>`0`: the file data will be stored.<br>`1-9`: the file data will be deflated.

### Options: IExtractOptions <a id="iextractoptions"></a>

Object
- `overwrite?`: Boolean (optional) - If it is true, the target directory will be deleted before extract. The default value is `false`.
- `safeSymlinksOnly`: Boolean (optional) - Controls the creation phase of symlinks. The default value is `false`.<br>`true`: Refuses to create any symlink whose target is outside the extraction root.<br>`false`: Allows creating external symlinks. **Note:** Subsequent write operations to these links will still be intercepted by the separate AFWRITE security layer.
- `symlinkAsFileOnWindows?`: Boolean (optional) - Extract symbolic links as files on Windows. This value is only available on Windows and ignored on other platforms. The default value is `true`.<br>If `true`, the symlink in the zip will be extracted as a normal file on Windows.<br>If `false`, the symlink in the zip will be extracted as a symlink correctly on Windows, but an `EPERM` error will be thrown under non-administrators.

    > ⚠**WARNING:** On Windows, the default security policy allows only administrators to create symbolic links. If you set `symlinkAsFileOnWindows` to `false` and the zip contains symlink, be sure to run the code under the administrator, otherwise an `EPERM` error will be thrown.

- `onEntry?`: Function (optional) - Called before an item is extracted.<br>Arguments:
    - `event`: Object - Represents an event that an entry is about to be extracted.
        - `entryName`: String (readonly) - Entry name.
        - `entryCount`: Number (readonly) - Total number of entries.
        - `preventDefault()`: Function - Prevent extracting current entry. This method can be used to prevent extraction of the current item. By calling this method we can control which items can be extracted.

# License
Licensed under the [MIT](https://github.com/fpsqdb/zip-lib/blob/master/LICENSE) license.