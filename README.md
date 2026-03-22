# zip-lib
A zip and unzip library for Node.js with promise-based APIs, support for compressing to `Buffer` or extracting from `Buffer`, and advanced features like entry filtering, cancellation, and symlink-aware handling.

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
    - Event: [IEntryEvent](#event-ientryevent)

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

### Set the compression level

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
		// Adds a folder from the file system, putting its contents at the root of the archive
		zip.addFolder("path/to/folder");
		// Generate the zip file.
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

And the contents of the generated `path/to/target.zip` archive will be as follows:

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
		// Adds a folder from the file system and names it `new folder` within the archive
		zip.addFolder("path/to/folder", "new folder");
		// Generate the zip file.
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

And the contents of the generated `path/to/target.zip` archive will be as follows:

```
path/to/target.zip
.
├── renamedFile.txt
├── folder
│   ├── file.txt
├── new folder
    ├── dir1
    │   ├── file.ext
    ├── dir2
    └── file_in_root.ext
```

### Unzip with entry callback
Using the `onEntry` callback, we can track extraction progress and control the extraction process. See [IExtractOptions](#iextractoptions).

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

Choose the API based on how much control you need:

- Use [`archiveFile`](#archivefile), [`archiveFolder`](#archivefolder), and [`extract`](#extract) for simple one-shot operations.
- Use [`Zip`](#class-zip) when you need to add multiple files or folders, rename entries, or cancel compression.
- Use [`Unzip`](#class-unzip) when you need to filter entries with `onEntry` or cancel extraction.

### Method: archiveFile <a id="archivefile"></a>

Compress a single file.

```ts
archiveFile(file: string, options?: IZipOptions): Promise<Buffer>
archiveFile(file: string, zipFile: string, options?: IZipOptions): Promise<void>
```

- `file`: Path to the source file.
- `zipFile`: Optional output zip file path.
- `options`: Optional [IZipOptions](#izipoptions).

If `zipFile` is provided, the archive is written to disk and the method returns `Promise<void>`. Otherwise it returns the generated zip as a `Buffer`.

### Method: archiveFolder <a id="archivefolder"></a>

Compress all contents of a folder.

```ts
archiveFolder(folder: string, options?: IZipOptions): Promise<Buffer>
archiveFolder(folder: string, zipFile: string, options?: IZipOptions): Promise<void>
```

- `folder`: Path to the source folder.
- `zipFile`: Optional output zip file path.
- `options`: Optional [IZipOptions](#izipoptions).

If `zipFile` is provided, the archive is written to disk and the method returns `Promise<void>`. Otherwise it returns the generated zip as a `Buffer`.

### Method: extract <a id="extract"></a>

Extract a zip file or zip buffer to a target folder.

```ts
extract(zipFile: string, targetFolder: string, options?: IExtractOptions): Promise<void>
extract(zipBuffer: Buffer, targetFolder: string, options?: IExtractOptions): Promise<void>
```

- `zipFile`: Path to a zip file on disk.
- `zipBuffer`: A zip archive in memory.
- `targetFolder`: Destination folder.
- `options`: Optional [IExtractOptions](#iextractoptions).

### Class: Zip <a id="class-zip"></a>

Build an archive incrementally when the top-level helpers are not enough.

**Constructor**

```ts
new Zip(options?: IZipOptions)
```

- `options`: Optional [IZipOptions](#izipoptions).

**Methods**

```ts
addFile(file: string, metadataPath?: string): void
addFolder(folder: string, metadataPath?: string): void
archive(): Promise<Buffer>
archive(zipFile: string): Promise<void>
cancel(): void
```

- `addFile`: Adds one file to the archive.
- `addFolder`: Adds one folder to the archive.
- `metadataPath`: Optional path stored inside the zip. A valid `metadataPath` must not start with `/` or `/[A-Za-z]:\//`, and must not contain `..`.
- `archive()`: Returns the zip as a `Buffer`.
- `archive(zipFile)`: Writes the zip directly to disk.
- `cancel()`: Cancels compression. Calling it after completion has no effect.

Use `metadataPath` to rename files or folders inside the archive. It is typically computed with `path.relative(root, realPath)`.

### Class: Unzip <a id="class-unzip"></a>

Extract with entry filtering and cancellation support.

**Constructor**

```ts
new Unzip(options?: IExtractOptions)
```

- `options`: Optional [IExtractOptions](#iextractoptions).

**Methods**

```ts
extract(zipFile: string, targetFolder: string): Promise<void>
extract(zipBuffer: Buffer, targetFolder: string): Promise<void>
cancel(): void
```

- `extract(...)`: Extracts from a zip file path or a `Buffer`.
- `cancel()`: Cancels extraction. Calling it after completion has no effect.

### Options: IZipOptions <a id="izipoptions"></a>

```ts
interface IZipOptions {
  followSymlinks?: boolean;
  compressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}
```

- `followSymlinks`: Default `false`. If `true`, adds the target of a symbolic link. If `false`, adds the symbolic link itself.
- `compressionLevel`: Default `6`. Use `0` to store file data without compression, or `1`-`9` to deflate file data.

### Options: IExtractOptions <a id="iextractoptions"></a>

```ts
interface IExtractOptions {
  overwrite?: boolean;
  safeSymlinksOnly?: boolean;
  symlinkAsFileOnWindows?: boolean;
  onEntry?: (event: IEntryEvent) => void;
}
```

- `overwrite`: Default `false`. If `true`, deletes the target directory before extraction.
- `safeSymlinksOnly`: Default `false`. If `true`, refuses to create symlinks whose targets are outside the extraction root.
- `symlinkAsFileOnWindows`: Default `true`. On Windows, if `true`, symbolic links are extracted as regular files. If `false`, the library tries to create real symbolic links instead. This may fail with `EPERM` when the current process is not allowed to create symlinks. Keep the default for better compatibility; set this to `false` only if you want to preserve symlinks as symlinks.
- `onEntry`: Called before an entry is extracted. Use it to inspect or skip entries.

> WARNING: On Windows, creating symbolic links may require administrator privileges, depending on system policy. If Windows Developer Mode is enabled, non-administrator processes can usually create symlinks as well. If `symlinkAsFileOnWindows` is `false` and the current process is not allowed to create symlinks, extraction may fail with `EPERM`.

### Event: IEntryEvent

```ts
interface IEntryEvent {
  readonly entryName: string;
  readonly entryCount: number;
  preventDefault(): void;
}
```

- `entryName`: The current entry name.
- `entryCount`: The total number of entries in the archive.
- `preventDefault()`: Skips the current entry.
# License
Licensed under the [MIT](https://github.com/fpsqdb/zip-lib/blob/master/LICENSE) license.
