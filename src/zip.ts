import * as yazl from "yazl";
import { WriteStream, createWriteStream, createReadStream } from "fs";
import * as exfs from "./fs";
import * as path from "path";
import * as util from "./util";
import { Cancelable } from "./cancelable";

interface ZipEntry {
    path: string;
    metadataPath?: string;
}

export interface IZipOptions {
    /**
     * Indicates how to handle when the given path is a symbolic link.
     *
     * `true`: add the target of the symbolic link to the zip.
     *
     * `false`: add symbolic link itself to the zip.
     *
     * The default value is `false`.
     */
    followSymlinks?: boolean
}

/**
 * Compress files or folders to a zip file.
 */
export class Zip extends Cancelable {
    /**
     *
     */
    constructor(private options?: IZipOptions) {
        super();
        this.zipFiles = [];
        this.zipFolders = [];
    }
    private yazlFile: yazl.ZipFile;
    private isPipe: boolean = false;
    private zipStream: WriteStream;
    private zipFiles: ZipEntry[];
    private zipFolders: ZipEntry[];

    private yazlErrorCallback?: (error: any) => void;
    /**
     * Adds a file from the file system at realPath into the zipfile as metadataPath.
     * @param file
     * @param metadataPath Typically metadataPath would be calculated as path.relative(root, realPath).
     * A valid metadataPath must not start with "/" or /[A-Za-z]:\//, and must not contain "..".
     */
    public addFile(file: string, metadataPath?: string): void {
        let mpath = metadataPath;
        if (!mpath) {
            mpath = path.basename(file);
        }
        this.zipFiles.push({
            path: file,
            metadataPath: mpath
        });
    }

    /**
     * Adds a folder from the file system at realPath into the zipfile as metadataPath.
     * @param folder
     * @param metadataPath Typically metadataPath would be calculated as path.relative(root, realPath).
     * A valid metadataPath must not start with "/" or /[A-Za-z]:\//, and must not contain "..".
     */
    public addFolder(folder: string, metadataPath?: string): void {
        this.zipFolders.push({
            path: folder,
            metadataPath: metadataPath
        });
    }

    /**
     * Generate zip file.
     * @param zipFile the zip file path.
     */
    public async archive(zipFile: string): Promise<void> {
        if (!zipFile) {
            return Promise.reject(new Error("zipPath must not be empty"));
        }
        this.isCanceled = false;
        this.isPipe = false;
        // Re-instantiate yazl every time the archive method is called to ensure that files are not added repeatedly.
        // This will also make the Zip class reusable.
        this.initYazl();
        return new Promise<void>(async (c, e) => {
            this.yazlErrorCallback = (err: any) => {
                this.yazlErrorCallback = undefined;
                e(err);
            };
            const zip = this.yazlFile;
            try {
                const files = this.zipFiles;
                for (let fi = 0; fi < files.length; fi++) {
                    const file = files[fi];
                    await this.addFileOrSymlink(zip, file.path, file.metadataPath!);
                }
                if (this.zipFolders.length > 0) {
                    await this.walkDir(this.zipFolders);
                }
                await exfs.ensureFolder(path.dirname(zipFile));
            } catch (error) {
                e(this.wrapError(error));
                return;
            }
            zip.end();
            if (!this.isCanceled) {
                this.zipStream = createWriteStream(zipFile);
                this.zipStream.once("error", (err) => {
                    e(this.wrapError(err));
                });
                this.zipStream.once("close", () => {
                    if (this.isCanceled) {
                        e(this.canceledError())
                    } else {
                        c(void 0)
                    }
                });
                zip.outputStream.once("error", (err) => {
                    e(this.wrapError(err));
                });
                zip.outputStream.pipe(this.zipStream);
                this.isPipe = true;
            }
        });
    }

    /**
     * Cancel compression.
     * If the cancel method is called after the archive is complete, nothing will happen.
     */
    public cancel(): void {
        super.cancel();
        this.stopPipe(this.canceledError());
    }

    private initYazl(): void {
        this.yazlFile = new yazl.ZipFile();
        (this.yazlFile as any).once("error", (err: any) => {
            this.stopPipe(this.wrapError(err));
        });
    }

    private async addFileOrSymlink(zip: yazl.ZipFile, file: string, metadataPath: string): Promise<void> {
        if (this.followSymlink()) {
            zip.addFile(file, metadataPath);
        } else {
            const stat = await util.lstat(file);
            const entry: exfs.FileEntry = {
                path: file,
                type: "file",
                mtime: stat.mtime,
                mode: stat.mode
            };
            if (stat.isSymbolicLink()) {
                await this.addSymlink(zip, entry, metadataPath)
            } else {
                this.addFileStream(zip, entry, metadataPath)
            }
        }
    }

    private addFileStream(zip: yazl.ZipFile, file: exfs.FileEntry, metadataPath: string): void {
        const fileStream = createReadStream(file.path);
        fileStream.once("error", (err) => {
            this.stopPipe(this.wrapError(err));
        });
        // If the file attribute is known, add the entry using `addReadStream`,
        // this can reduce the number of calls to the `fs.stat` method.
        zip.addReadStream(fileStream, metadataPath, {
            mode: file.mode,
            mtime: file.mtime
        });
    }

    private async addSymlink(zip: yazl.ZipFile, file: exfs.FileEntry, metadataPath: string): Promise<void> {
        const linkTarget = await util.readlink(file.path);
        zip.addBuffer(Buffer.from(linkTarget), metadataPath, {
            mtime: file.mtime,
            mode: file.mode
        })
    }

    private async walkDir(folders: ZipEntry[]): Promise<void> {
        for (let fi = 0; fi < folders.length; fi++) {
            if (this.isCanceled) {
                return;
            }
            const folder = folders[fi];
            const entries = await exfs.readdirp(folder.path);
            if (entries.length > 0) {
                for (let ei = 0; ei < entries.length; ei++) {
                    const entry = entries[ei];
                    if (this.isCanceled) {
                        return;
                    }
                    const relativePath = path.relative(folder.path, entry.path);
                    const metadataPath = folder.metadataPath ? path.join(folder.metadataPath, relativePath) : relativePath;
                    if (entry.type === "dir") {
                        this.yazlFile.addEmptyDirectory(metadataPath, {
                            mtime: entry.mtime,
                            mode: entry.mode
                        });
                    } else if (entry.type === "symlink" && !this.followSymlink()) {
                        await this.addSymlink(this.yazlFile, entry, metadataPath);
                    } else {
                        this.addFileStream(this.yazlFile, entry, metadataPath);
                    }
                }
            } else {
                // If the folder is empty and the metadataPath has a value,
                // an empty folder should be created based on the metadataPath
                if (folder.metadataPath) {
                    this.yazlFile.addEmptyDirectory(folder.metadataPath);
                }
            }
        }
    }

    private stopPipe(err: Error): void {
        if (this.yazlErrorCallback) {
            this.yazlErrorCallback(err);
        }
        if (this.isPipe) {
            this.yazlFile.outputStream.unpipe(this.zipStream);
            this.zipStream.destroy(err);
            this.isPipe = false;
        }
    }

    private followSymlink(): boolean {
        let followSymlink: boolean = false;
        if (this.options &&
            this.options.followSymlinks === true) {
            followSymlink = true;
        }
        return followSymlink;
    }
}