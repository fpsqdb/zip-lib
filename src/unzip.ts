import * as yauzl from "yauzl";
import * as exfs from "./fs";
import { WriteStream, createWriteStream } from "fs";
import * as path from "path";
import { Readable } from "stream";
import * as util from "./util";
import { Cancelable, CancellationToken } from "./cancelable";

export interface IExtractOptions {
    /**
     * If it is `true`, the target directory will be deleted before extract.
     * The default value is `false`.
     */
    overwrite?: boolean;
    /**
     * Extract symbolic links as files on Windows. This value is only available on Windows and ignored on other platforms.
     * The default value is `true`.
     *
     * If `true`, the symlink in the zip will be extracted as a normal file on Windows.
     *
     * If `false`, the symlink in the zip will be extracted as a symlink correctly on Windows, but an `EPERM` error will be thrown under non-administrators.
     *
     * > ⚠**WARNING:** On Windows, the default security policy allows only administrators to create symbolic links.
     * If you set `symlinkAsFileOnWindows` to `false` and the zip contains symlink,
     * be sure to run the code under the administrator, otherwise an `EPERM` error will be thrown.
     */
    symlinkAsFileOnWindows?: boolean;
    /**
     * Called before an item is extracted.
     * @param event
     */
    onEntry?: (event: IEntryEvent) => void;
}

/**
 * The IEntryEvent interface represents an event that an entry is about to be extracted.
 */
export interface IEntryEvent {
    /**
     * Entry name.
     */
    readonly entryName: string;
    /**
     * Total number of entries.
     */
    readonly entryCount: number;
    /**
     * Prevent extracting current entry.
     */
    preventDefault(): void;
}

class EntryEvent implements IEntryEvent {
    /**
     *
     */
    constructor(private _entryCount: number) {

    }
    private _entryName: string;
    get entryName(): string {
        return this._entryName;
    }
    set entryName(name: string) {
        this._entryName = name;
    }

    get entryCount(): number {
        return this._entryCount;
    }

    private _isPrevented: boolean = false;
    get isPrevented(): boolean {
        return this._isPrevented;
    }

    public preventDefault(): void {
        this._isPrevented = true;
    }

    public reset(): void {
        this._isPrevented = false;
    }
}

/**
 * Extract the zip file.
 */
export class Unzip extends Cancelable {
    /**
     *
     */
    constructor(private options?: IExtractOptions) {
        super();
    }

    private zipFile: yauzl.ZipFile | null;

    private token: CancellationToken | null;
    /**
     * Extract the zip file to the specified location.
     * @param zipFile
     * @param targetFolder
     * @param options
     */
    public async extract(zipFile: string, targetFolder: string): Promise<void> {
        let extractedEntriesCount: number = 0;
        const token = new CancellationToken();
        this.token = token;
        if (this.isOverwrite()) {
            await exfs.rimraf(targetFolder);
        }
        if (token.isCancelled) {
            return Promise.reject(this.canceledError());
        }
        await exfs.ensureFolder(targetFolder);
        const zfile = await this.openZip(zipFile, token);
        this.zipFile = zfile;
        zfile.readEntry();
        return new Promise<void>((c, e) => {
            let anyError: Error | null = null;
            const total: number = zfile.entryCount;
            zfile.once("error", (err) => {
                this.closeZip();
                e(this.wrapError(err, token.isCancelled));
            });
            zfile.once("close", () => {
                this.zipFile = null;
                if (anyError) {
                    e(this.wrapError(anyError, token.isCancelled));
                } else {
                    if (token.isCancelled) {
                        e(this.canceledError());
                    }
                    // If the zip content is empty, it will not receive the `zfile.on("entry")` event.
                    else if (total === 0) {
                        c(void 0);
                    }
                }
            });
            // Because openZip is an asynchronous method, openZip may not be completed when calling cancel,
            // so we need to check if it has been canceled after the openZip method returns.
            if (token.isCancelled) {
                this.closeZip();
                return;
            }
            const entryEvent: EntryEvent = new EntryEvent(total);
            zfile.on("entry", async (entry: yauzl.Entry) => {
                // use UTF-8 in all situations
                // see https://github.com/thejoshwolfe/yauzl/issues/84
                const rawName = (entry.fileName as any as Buffer).toString("utf8");
                // allow backslash
                const fileName = rawName.replace(/\\/g, "/");
                // Because `decodeStrings` is `false`, we need to manually verify the entryname
                // see https://github.com/thejoshwolfe/yauzl#validatefilenamefilename
                const errorMessage = yauzl.validateFileName(fileName);
                if (errorMessage != null) {
                    anyError = new Error(errorMessage);
                    this.closeZip();
                    e(anyError);
                    return;
                }
                entryEvent.entryName = fileName;
                this.onEntryCallback(entryEvent);
                try {
                    if (entryEvent.isPrevented) {
                        entryEvent.reset();
                        zfile.readEntry();
                    } else {
                        await this.handleEntry(zfile, entry, fileName, targetFolder, token);
                    }
                    extractedEntriesCount++;
                    if (extractedEntriesCount === total) {
                        c();
                    }
                } catch (error) {
                    anyError = this.wrapError(error, token.isCancelled);
                    this.closeZip();
                    e(anyError);
                }
            });
        });
    }

    /**
     * Cancel decompression.
     * If the cancel method is called after the extract is complete, nothing will happen.
     */
    public cancel(): void {
        if(this.token) {
            this.token.cancel();
            this.token = null;
        }
        this.closeZip();
    }

    private closeZip(): void {
        if (this.zipFile) {
            this.zipFile.close();
            this.zipFile = null;
        }
    }

    private openZip(zipFile: string, token: CancellationToken): Promise<yauzl.ZipFile> {
        return new Promise<yauzl.ZipFile>((c, e) => {
            yauzl.open(zipFile, {
                lazyEntries: true,
                // see https://github.com/thejoshwolfe/yauzl/issues/84
                decodeStrings: false
            }, (err, zfile) => {
                if (err) {
                    e(this.wrapError(err, token.isCancelled));
                } else {
                    c(zfile!);
                }
            });
        });
    }

    private async handleEntry(zfile: yauzl.ZipFile, entry: yauzl.Entry, decodeEntryFileName: string, targetPath: string, token: CancellationToken): Promise<void> {
        if (/\/$/.test(decodeEntryFileName)) {
            // Directory file names end with '/'.
            // Note that entires for directories themselves are optional.
            // An entry's fileName implicitly requires its parent directories to exist.
            await exfs.ensureFolder(path.join(targetPath, decodeEntryFileName));
            zfile.readEntry();
        } else {
            // file entry
            await this.extractEntry(zfile, entry, decodeEntryFileName, targetPath, token);
        }
    }

    private openZipFileStream(zfile: yauzl.ZipFile, entry: yauzl.Entry, token: CancellationToken): Promise<Readable> {
        return new Promise<Readable>((c, e) => {
            zfile.openReadStream(entry, (err, readStream) => {
                if (err) {
                    e(this.wrapError(err, token.isCancelled));
                } else {
                    c(readStream!);
                }
            });
        });
    }

    private async extractEntry(zfile: yauzl.ZipFile, entry: yauzl.Entry, decodeEntryFileName: string, targetPath: string, token: CancellationToken): Promise<void> {
        const filePath = path.join(targetPath, decodeEntryFileName);
        const fileDir = path.dirname(filePath);
        await exfs.ensureFolder(fileDir);
        const realFilePath = await util.realpath(fileDir);
        const realTargetPath = await util.realpath(targetPath);
        if (realFilePath.indexOf(realTargetPath) !== 0) {
            const error = new Error(`Refuse to write file outside "${targetPath}", path: "${realFilePath}"`);
            error.name = "AFWRITE";
            return Promise.reject(error);
        }
        const readStream = await this.openZipFileStream(zfile, entry, token);
        await this.writeEntryToFile(readStream, entry, filePath, token);
        zfile.readEntry();
    }

    private async writeEntryToFile(readStream: Readable, entry: yauzl.Entry, filePath: string, token: CancellationToken): Promise<void> {
        let fileStream: WriteStream;
        token.onCancelled(() => {
            if (fileStream) {
                readStream.unpipe(fileStream);
                fileStream.destroy(this.canceledError());
            }
        });
        return new Promise<void>(async (c, e) => {
            try {
                const mode = this.modeFromEntry(entry);
                // see https://unix.stackexchange.com/questions/193465/what-file-mode-is-a-symlink
                const isSymlink = ((mode & 0o170000) === 0o120000);
                readStream.once("error", (err) => {
                    e(this.wrapError(err, token.isCancelled));
                });

                if (isSymlink && !this.symlinkToFile()) {
                    let linkContent: string = "";
                    readStream.on("data", (chunk: string | Buffer) => {
                        if (chunk instanceof String) {
                            linkContent += chunk;
                        } else {
                            linkContent += chunk.toString();
                        }
                    });
                    readStream.once("end", () => {
                        this.createSymlink(linkContent, filePath).then(c, e);
                    });
                } else {
                    fileStream = createWriteStream(filePath, { mode });
                    fileStream.once("close", () => c());
                    fileStream.once("error", (err) => {
                        e(this.wrapError(err, token.isCancelled));
                    });
                    readStream.pipe(fileStream);
                }
            } catch (error) {
                e(this.wrapError(error, token.isCancelled));
            }
        });
    }

    private modeFromEntry(entry: yauzl.Entry): number {
        const attr = entry.externalFileAttributes >> 16 || 33188;

        return [448 /* S_IRWXU */, 56 /* S_IRWXG */, 7 /* S_IRWXO */]
            .map(mask => attr & mask)
            .reduce((a, b) => a + b, attr & 61440 /* S_IFMT */);
    }

    private async createSymlink(linkContent: string, des: string): Promise<void> {
        let linkType: "dir" | "file" | "junction" | null | undefined = "file";
        if (/\/$/.test(linkContent)) {
            linkType = "dir";
        } else {
            let targetPath = linkContent;
            if (!path.isAbsolute(linkContent)) {
                targetPath = path.join(path.dirname(des), linkContent);
            }
            try {
                const stat = await util.stat(targetPath);
                if(stat.isDirectory()) {
                    linkType = "dir";
                }
            } catch (error) {
                // ignore
            }
        }
        await util.symlink(linkContent, des, linkType);
    }

    private isOverwrite(): boolean {
        if (this.options &&
            this.options.overwrite) {
            return true;
        }
        return false;
    }

    private onEntryCallback(event: IEntryEvent): void {
        if (this.options && this.options.onEntry) {
            this.options.onEntry(event);
        }
    }

    private symlinkToFile(): boolean {
        let symlinkToFile: boolean = false;
        if (process.platform === "win32") {
            if (this.options &&
                this.options.symlinkAsFileOnWindows === false) {
                symlinkToFile = false;
            } else {
                symlinkToFile = true;
            }
        }
        return symlinkToFile;
    }
}