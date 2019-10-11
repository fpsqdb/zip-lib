import * as yazl from "yazl";
import * as fs from "fs";
import * as exfs from "./fs";
import * as path from "path";
import { promisify } from 'util';

interface ZipEntry {
    path: string;
    metadataPath?: string;
}

export interface IZipOptions {
    /**
     * If it is true, the target file will be deleted before archive. 
     * The default value is false.
     */
    overwrite?: boolean;
    /**
     * Store symbolic links as files.
     * The default value is false.
     */
    storeSymlinkAsFile?: boolean
}

/**
 * Compress files or folders to a zip file.
 */
export class Zip {
    /**
     *
     */
    constructor(private options?: IZipOptions) {
        this.yazlFile = new yazl.ZipFile();
        (this.yazlFile as any).once("error", (err: any) => {
            this.stopPipe(err);
        });
        this.zipFiles = [];
        this.zipFolders = [];
    }
    private yazlFile: yazl.ZipFile;
    private isPipe: boolean = false;
    private isCanceled: boolean = false;
    private targetZipFilePath: string;
    private zipStream: fs.WriteStream;
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
        this.targetZipFilePath = zipFile;
        if(this.isOverwrite()){
            await this.removeFile(zipFile);
        }
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
                await this.ensureZipPath(zipFile);
            } catch (error) {
                e(error);
                return;
            }
            zip.end();
            if (!this.isCanceled) {
                this.zipStream = fs.createWriteStream(zipFile);
                this.zipStream.once('error', e);
                this.zipStream.once('close', () => c(void 0));
                zip.outputStream.once('error', e);
                zip.outputStream.pipe(this.zipStream);
                this.isPipe = true;
            }
        });
    }

    /**
     * Cancel compression.
     * Whether the archive operation is completed or not. 
     * Once the cancel method is called, the generated zip file will be deleted.
     */
    public cancel(): void {
        this.stopPipe(this.canceled());
    }

    private async addFileOrSymlink(zip: yazl.ZipFile, file: string, metadataPath: string): Promise<void> {
        if (this.options && this.options.storeSymlinkAsFile) {
            zip.addFile(file, metadataPath);
        } else {
            const stat = await promisify(fs.lstat)(file);
            if (stat.isSymbolicLink()) {
                const linkTarget = await promisify(fs.readlink)(file);
                zip.addBuffer(Buffer.from(linkTarget), metadataPath, {
                    mtime: stat.mtime,
                    mode: stat.mode
                })
            } else {
                zip.addFile(file, metadataPath);
            }
        }
    }

    private async walkDir(folders: ZipEntry[]): Promise<void> {
        for (let fi = 0; fi < folders.length; fi++) {
            if (this.isCanceled) {
                return;
            }
            const folder = folders[fi];
            const entries = await exfs.readdirp(folder.path);
            for (let ei = 0; ei < entries.length; ei++) {
                const entry = entries[ei];
                if (this.isCanceled) {
                    return;
                }
                const relativePath = path.relative(folder.path, entry.path);
                const metadataPath = folder.metadataPath ? path.join(folder.metadataPath, relativePath) : relativePath;
                if (entry.isDirectory) {
                    this.yazlFile.addEmptyDirectory(metadataPath, {
                        mtime: entry.mtime,
                        mode: entry.mode
                    });
                } else {
                    this.addFileOrSymlink(this.yazlFile, entry.path, metadataPath);
                }
            }
        }
    }

    private async ensureZipPath(zipPath: string): Promise<void> {
        const exist = await exfs.pathExists(zipPath);
        if (exist) {
            await promisify(fs.unlink)(zipPath);
        } else {
            await exfs.ensureFolder(path.dirname(zipPath));
        }
    }

    private stopPipe(err: Error): void {
        this.isCanceled = true;
        if (this.isPipe) {
            this.yazlFile.outputStream.unpipe(this.zipStream);
            this.zipStream.destroy(err);
            this.isPipe = false;
            this.removeFile(this.targetZipFilePath);
        } else {
            if (this.yazlErrorCallback) {
                this.yazlErrorCallback(err);
            }
        }
    }

    /**
     * Returns an error that signals cancellation.
     */
    private canceled(): Error {
        let error = new Error("Canceled");
        error.name = error.message;
        return error;
    }

    private isOverwrite(): boolean {
        if (this.options &&
            this.options.overwrite) {
            return true;
        }
        return false;
    }

    private async removeFile(file: string): Promise<void> {
        try {
            await exfs.rimraf(file);
        } catch (error) {
            // ignore error
        }
    }
}