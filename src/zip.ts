import { createReadStream, createWriteStream, type WriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Writable } from "node:stream";
import * as yazl from "yazl";
import { Cancelable, CancellationToken } from "./cancelable";
import * as exfs from "./fs";

interface ZipFileEntry {
    path: string;
    metadataPath: string;
}

interface ZipFolderEntry {
    path: string;
    metadataPath?: string;
}

type ArchiveSettler = {
    resolve(value: void | Buffer): void;
    reject(error: Error): void;
};

type ActiveArchive = {
    zip: yazl.ZipFile;
    mode: "file" | "buffer";
    zipStream?: WriteStream;
};

export interface IZipOptions {
    /**
     * Indicates how to handle the given path when it is a symbolic link.
     *
     * `true`: add the target of the symbolic link to the zip.
     *
     * `false`: add the symbolic link itself to the zip.
     *
     * The default value is `false`.
     */
    followSymlinks?: boolean;
    /**
     * Sets the compression level.
     *
     * `0`: the file data will be stored; otherwise, the file data will be deflated.
     *
     * The default value is `6`.
     */
    compressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
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
    private zipFiles: ZipFileEntry[];
    private zipFolders: ZipFolderEntry[];

    private token: CancellationToken | null = null;
    private activeArchive: ActiveArchive | null = null;
    /**
     * Adds a file from the file system at `realPath` to the zip file as `metadataPath`.
     * @param file
     * @param metadataPath Typically, `metadataPath` would be calculated as `path.relative(root, realPath)`.
     * A valid metadataPath must not start with "/" or /[A-Za-z]:\//, and must not contain "..".
     */
    public addFile(file: string, metadataPath?: string): void {
        let mPath = metadataPath;
        if (!mPath) {
            mPath = path.basename(file);
        }
        this.zipFiles.push({
            path: file,
            metadataPath: mPath,
        });
    }

    /**
     * Adds a folder from the file system at `realPath` to the zip file as `metadataPath`.
     * @param folder
     * @param metadataPath Typically, `metadataPath` would be calculated as `path.relative(root, realPath)`.
     * A valid metadataPath must not start with "/" or /[A-Za-z]:\//, and must not contain "..".
     */
    public addFolder(folder: string, metadataPath?: string): void {
        this.zipFolders.push({
            path: folder,
            metadataPath,
        });
    }

    /**
     * Zips the content and returns it as a single Buffer.
     *
     * @returns A promise that resolves to the zipped Buffer.
     */
    public async archive(): Promise<Buffer>;
    /**
     * Zips the content and saves it directly to the specified file path.
     *
     * @param zipFile The absolute or relative path where the .zip file will be created.
     * @returns A promise that resolves when the file has been fully written.
     */
    public async archive(zipFile: string): Promise<void>;
    public async archive(zipFile?: string): Promise<void | Buffer> {
        const token = new CancellationToken();
        this.token = token;
        const zip = await this.prepareArchive(zipFile);
        const activeArchive: ActiveArchive = {
            zip,
            mode: zipFile ? "file" : "buffer",
        };
        this.activeArchive = activeArchive;

        try {
            return await new Promise<void | Buffer>((resolve, reject) => {
                let disposeCancel = () => {
                    // noop
                };
                const settle = this.createPromiseSettler(
                    (value) => {
                        disposeCancel();
                        resolve(value);
                    },
                    (error) => {
                        disposeCancel();
                        reject(error);
                    },
                );
                disposeCancel = token.onCancelled(() => {
                    this.stop(this.canceledError(), activeArchive);
                    settle.reject(this.canceledError());
                });
                this.bindArchiveOutput(zip, zipFile, token, settle, activeArchive);

                this.addQueuedEntries(zip, token)
                    .catch((error) => {
                        settle.reject(this.wrapError(error, token.isCancelled));
                    })
                    .finally(() => {
                        zip.end();
                    });
            });
        } finally {
            if (this.token === token) {
                this.token = null;
            }
            if (this.activeArchive === activeArchive) {
                this.activeArchive = null;
            }
        }
    }

    private async prepareArchive(zipFile?: string): Promise<yazl.ZipFile> {
        if (zipFile) {
            await exfs.ensureFolder(path.dirname(zipFile));
        }
        // Re-instantiate yazl every time the archive method is called to ensure that files are not added repeatedly.
        // This will also make the Zip class reusable.
        return new yazl.ZipFile();
    }

    private bindArchiveOutput(
        zip: yazl.ZipFile,
        zipFile: string | undefined,
        token: CancellationToken,
        settle: ArchiveSettler,
        activeArchive: ActiveArchive,
    ): void {
        if (zipFile) {
            void this.archiveToFile(zip, zipFile, token, settle, activeArchive);
            return;
        }

        void this.archiveToBuffer(zip, token, settle);
    }

    private async archiveToFile(
        zip: yazl.ZipFile,
        zipFile: string,
        token: CancellationToken,
        settle: ArchiveSettler,
        activeArchive: ActiveArchive,
    ): Promise<void> {
        const zipStream = createWriteStream(zipFile);
        activeArchive.zipStream = zipStream;
        const archivePromise = new Promise<void>((resolve) => {
            zip.once("error", (err) => {
                settle.reject(this.wrapError(err, token.isCancelled));
                resolve();
            });
            zipStream.once("error", (err) => {
                settle.reject(this.wrapError(err, token.isCancelled));
                resolve();
            });
            zipStream.once("close", () => {
                if (token.isCancelled) {
                    settle.reject(this.canceledError());
                } else {
                    settle.resolve(void 0);
                }
                resolve();
            });
        });

        zip.outputStream.pipe(zipStream);
        await archivePromise;
    }

    private async archiveToBuffer(zip: yazl.ZipFile, token: CancellationToken, settle: ArchiveSettler): Promise<void> {
        const chunks: Buffer[] = [];
        const archivePromise = new Promise<void>((resolve) => {
            zip.once("error", (err) => {
                settle.reject(this.wrapError(err, token.isCancelled));
                resolve();
            });
            zip.outputStream.on("data", (chunk: Buffer) => {
                chunks.push(chunk);
            });
            zip.outputStream.once("end", () => {
                settle.resolve(Buffer.concat(chunks));
                resolve();
            });
            zip.outputStream.once("error", (err) => {
                settle.reject(this.wrapError(err, token.isCancelled));
                resolve();
            });
        });

        await archivePromise;
    }

    private createPromiseSettler(
        resolve: (value: void | Buffer) => void,
        reject: (error: Error) => void,
    ): ArchiveSettler {
        let settled = false;

        return {
            resolve: (value: void | Buffer) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(value);
            },
            reject: (error: Error) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(error);
            },
        };
    }

    private async addQueuedEntries(zip: yazl.ZipFile, token: CancellationToken): Promise<void> {
        for (const file of this.zipFiles) {
            const entry = await exfs.getFileEntry(file.path);
            await this.addEntry(zip, entry, file, token);
        }
        if (this.zipFolders.length > 0) {
            await this.walkDir(zip, this.zipFolders, token);
        }
    }

    /**
     * Cancel compression.
     * If the cancel method is called after the archive is complete, nothing will happen.
     */
    public cancel(): void {
        if (this.token) {
            this.token.cancel();
            this.token = null;
        }
        this.stop(this.canceledError());
    }

    private async addEntry(
        zip: yazl.ZipFile,
        entry: exfs.FileEntry,
        file: ZipFileEntry,
        token: CancellationToken,
    ): Promise<void> {
        if (entry.isSymbolicLink) {
            if (this.followSymlink()) {
                if (entry.type === "dir") {
                    const realPath = await exfs.realpath(file.path);
                    await this.walkDir(zip, [{ path: realPath, metadataPath: file.metadataPath }], token);
                } else {
                    zip.addFile(file.path, file.metadataPath, this.getYazlOption());
                }
            } else {
                await this.addSymlink(zip, entry, file.metadataPath);
            }
        } else {
            if (entry.type === "dir") {
                zip.addEmptyDirectory(file.metadataPath, {
                    mtime: entry.mtime,
                    mode: entry.mode,
                });
            } else {
                await this.addFileStream(zip, entry, file.metadataPath, token);
            }
        }
    }

    private addFileStream(
        zip: yazl.ZipFile,
        file: exfs.FileEntry,
        metadataPath: string,
        token: CancellationToken,
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const fileStream = createReadStream(file.path);
            const disposeCancel = token.onCancelled(() => {
                fileStream.destroy(this.canceledError());
            });
            fileStream.once("error", (err) => {
                disposeCancel();
                const wrappedError = this.wrapError(err, token.isCancelled);
                this.stop(wrappedError);
                reject(wrappedError);
            });
            fileStream.once("close", () => {
                disposeCancel();
                resolve();
            });

            // If the file attribute is known, add the entry using `addReadStream`,
            // this can reduce the number of calls to the `fs.stat` method.
            zip.addReadStream(fileStream, metadataPath, {
                ...this.getYazlOption(),
                mode: file.mode,
                mtime: file.mtime,
            });
        });
    }

    private async addSymlink(zip: yazl.ZipFile, file: exfs.FileEntry, metadataPath: string): Promise<void> {
        const linkTarget = await fs.readlink(file.path);
        zip.addBuffer(Buffer.from(linkTarget), metadataPath, {
            ...this.getYazlOption(),
            mtime: file.mtime,
            mode: file.mode,
        });
    }

    private async walkDir(zip: yazl.ZipFile, folders: ZipFolderEntry[], token: CancellationToken): Promise<void> {
        for (const folder of folders) {
            if (token.isCancelled) {
                return;
            }
            const entries = await exfs.readdirp(folder.path);
            if (entries.length > 0) {
                for (const entry of entries) {
                    if (token.isCancelled) {
                        return;
                    }
                    const relativePath = path.relative(folder.path, entry.path);
                    const metadataPath = folder.metadataPath
                        ? path.join(folder.metadataPath, relativePath)
                        : relativePath;
                    await this.addEntry(zip, entry, { path: entry.path, metadataPath }, token);
                }
            } else {
                // If the folder is empty and the metadataPath has a value,
                // an empty folder should be created based on the metadataPath
                if (folder.metadataPath) {
                    zip.addEmptyDirectory(folder.metadataPath);
                }
            }
        }
    }

    private stop(err: Error, activeArchive?: ActiveArchive): void {
        const archive = activeArchive ?? this.activeArchive;
        if (!archive) {
            return;
        }
        if (archive.mode === "file" && archive.zipStream) {
            archive.zip.outputStream.unpipe(archive.zipStream);
            archive.zipStream.destroy(err);
        }
        if (archive.mode === "buffer") {
            (archive.zip.outputStream as unknown as Writable).destroy(err);
        }
        if (!activeArchive || this.activeArchive === activeArchive) {
            this.activeArchive = null;
        }
    }

    private followSymlink(): boolean {
        let followSymlink: boolean = false;
        if (this.options && this.options.followSymlinks === true) {
            followSymlink = true;
        }
        return followSymlink;
    }

    /**
     * Retrieves the yazl options based on the current settings.
     *
     * @returns The yazl options with the specified compression level,
     * or undefined if options or compressionLevel are not properly set.
     */
    private getYazlOption(): Partial<yazl.Options> | undefined {
        if (!this.options) {
            return undefined;
        }
        if (typeof this.options.compressionLevel !== "number") {
            return undefined;
        }
        return {
            compressionLevel: this.options.compressionLevel,
        };
    }
}
