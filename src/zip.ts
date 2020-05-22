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
    followSymlinks?: boolean;
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
            metadataPath
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
        await exfs.ensureFolder(path.dirname(zipFile));
        return new Promise<void>(async (c, e) => {
            this.yazlErrorCallback = (err: any) => {
                this.yazlErrorCallback = undefined;
                e(err);
            };
            const zip = this.yazlFile;
            if (!this.isCanceled) {
                this.zipStream = createWriteStream(zipFile);
                this.zipStream.once("error", (err) => {
                    e(this.wrapError(err));
                });
                this.zipStream.once("close", () => {
                    if (this.isCanceled) {
                        e(this.canceledError());
                    } else {
                        c(void 0);
                    }
                });
                zip.outputStream.once("error", (err) => {
                    e(this.wrapError(err));
                });
                zip.outputStream.pipe(this.zipStream);
                this.isPipe = true;
            }
            try {
                const files = this.zipFiles;
                for (const file of files) {
                    const entry = await exfs.getFileEntry(file.path);
                    await this.addEntry(zip, entry, file);
                }
                if (this.zipFolders.length > 0) {
                    await this.walkDir(this.zipFolders);
                }
            } catch (error) {
                e(this.wrapError(error));
                return;
            }
            zip.end();
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

    private async addEntry(zip: yazl.ZipFile, entry: exfs.FileEntry, file: ZipEntry): Promise<void> {
        if (entry.isSymbolicLink) {
            if (this.followSymlink()) {
                if (entry.type === "dir") {
                    const realPath = await util.realpath(file.path);
                    await this.walkDir([{ path: realPath, metadataPath: file.metadataPath }]);
                } else {
                    zip.addFile(file.path, file.metadataPath!);
                }
            } else {
                await this.addSymlink(zip, entry, file.metadataPath!);
            }
        } else {
            if (entry.type === "dir") {
                zip.addEmptyDirectory(file.metadataPath!, {
                    mtime: entry.mtime,
                    mode: entry.mode
                });
            } else {
                await this.addFileStream(zip, entry, file.metadataPath!);
            }
        }
    }

    private addFileStream(zip: yazl.ZipFile, file: exfs.FileEntry, metadataPath: string): Promise<void> {
        return new Promise<void>((c, e) => {
            const fileStream = createReadStream(file.path);
            fileStream.once("error", (err) => {
                const wrappedError = this.wrapError(err);
                this.stopPipe(wrappedError);
                e(wrappedError);
            });
            fileStream.once("close", () => {
                c();
            });
            // If the file attribute is known, add the entry using `addReadStream`,
            // this can reduce the number of calls to the `fs.stat` method.
            zip.addReadStream(fileStream, metadataPath, {
                mode: file.mode,
                mtime: file.mtime
            });
        });
    }

    private async addSymlink(zip: yazl.ZipFile, file: exfs.FileEntry, metadataPath: string): Promise<void> {
        const linkTarget = await util.readlink(file.path);
        zip.addBuffer(Buffer.from(linkTarget), metadataPath, {
            mtime: file.mtime,
            mode: file.mode
        });
    }

    private async walkDir(folders: ZipEntry[]): Promise<void> {
        for (const folder of folders) {
            if (this.isCanceled) {
                return;
            }
            const entries = await exfs.readdirp(folder.path);
            if (entries.length > 0) {
                for (const entry of entries) {
                    if (this.isCanceled) {
                        return;
                    }
                    const relativePath = path.relative(folder.path, entry.path);
                    const metadataPath = folder.metadataPath ? path.join(folder.metadataPath, relativePath) : relativePath;
                    await this.addEntry(this.yazlFile, entry, { path: entry.path, metadataPath });
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