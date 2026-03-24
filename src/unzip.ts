import { createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as yauzl from "yauzl";
import { Cancelable, CancellationToken } from "./cancelable";
import * as exfs from "./fs";

export interface IExtractOptions {
    /**
     * If it is `true`, the target directory will be deleted before extraction.
     * The default value is `false`.
     */
    overwrite?: boolean;
    /**
     * Extracts symbolic links as files on Windows. This value is only available on Windows and is ignored on other platforms.
     * The default value is `true`.
     *
     * If `true`, the symlink in the zip will be extracted as a normal file on Windows.
     *
     * If `false`, the library will try to extract symlinks as real symlinks on Windows.
     * This may fail with an `EPERM` error when the current process is not allowed to create symlinks.
     *
     * > ⚠**WARNING:** On Windows, creating symbolic links may require administrator privileges,
     * depending on system policy. If Windows Developer Mode is enabled, non-administrator
     * processes can usually create symlinks as well.
     */
    symlinkAsFileOnWindows?: boolean;
    /**
     * Controls the creation phase of symlinks.
     *
     * `true`: Refuses to create any symlink whose target is outside the extraction root.
     *
     * `false`: Allows creating external symlinks. **Note:** Subsequent write operations to these
     * links will still be intercepted by the separate AFWRITE security layer.
     *
     * The default value is `false`.
     */
    safeSymlinksOnly?: boolean;
    /**
     * Called before an item is extracted.
     * @param event
     */
    onEntry?: (event: IEntryEvent) => void;
}

/**
 * Represents an event fired before an entry is extracted.
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
     * Prevents the current entry from being extracted.
     */
    preventDefault(): void;
}

class EntryEvent implements IEntryEvent {
    /**
     *
     */
    constructor(private _entryCount: number) {}
    private _entryName: string = "";
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

interface IEntryContext {
    /**
     * Entry name after utf8 decoding.
     */
    decodeEntryFileName: string;
    readonly targetFolder: string;
    /**
     * The real path obtained by fs.realpath.
     */
    readonly realTargetFolder: string;
    /**
     * The names of symlink files that have been processed.
     */
    readonly symlinkFileNames: string[];
    getFilePath(): string;
    /**
     * Whether the symlink target path is outside the target folder.
     * @param linkTarget
     * @param linkFilePath
     */
    isSymlinkTargetOutsideTargetFolder(linkTarget: string, linkFilePath: string): boolean;
    /**
     * Whether the specified path is outside the target folder.
     * @param tpath
     */
    isOutsideTargetFolder(tpath: string): Promise<boolean>;
    inspectFolder(folder: string): Promise<void>;
    ensureFolder(folder: string): Promise<void>;
}

class EntryContext implements IEntryContext {
    constructor(
        private _targetFolder: string,
        private _realTargetFolder: string,
        private symlinkAsFileOnWindows: boolean,
    ) {
        this._symlinkFileNames = [];
        this._symlinkFolders = [];
        this._inspectedFolders = [];
        this._ensuredFolders = [];
    }
    private _decodeEntryFileName: string = "";
    public get decodeEntryFileName(): string {
        return this._decodeEntryFileName;
    }
    public set decodeEntryFileName(name: string) {
        this._decodeEntryFileName = name;
    }
    public get targetFolder(): string {
        return this._targetFolder;
    }
    public get realTargetFolder(): string {
        return this._realTargetFolder;
    }
    private _symlinkFileNames: string[];
    public get symlinkFileNames(): string[] {
        return this._symlinkFileNames;
    }
    private _symlinkFolders: { folder: string; realpath: string }[];
    private _inspectedFolders: string[];
    private _ensuredFolders: string[];

    private addSymlinkFolder(folder: string, realpath: string): void {
        const find = this._symlinkFolders.find((item) => item.folder === folder);
        if (!find) {
            this._symlinkFolders.push({ folder, realpath });
        }
    }

    public getFilePath(): string {
        return path.resolve(path.join(this.targetFolder, this.decodeEntryFileName));
    }

    public async inspectFolder(folder: string): Promise<void> {
        if (this._inspectedFolders.includes(folder) || folder === path.dirname(folder)) {
            return;
        }

        await this.inspectFolder(path.dirname(folder));

        const folderStat = await exfs.statFolder(folder);
        if (!folderStat) {
            return;
        }
        if (folderStat.isSymbolicLink) {
            this.addSymlinkFolder(folder, folderStat.realpath);
        }
        this._inspectedFolders.push(folder);
    }

    public async ensureFolder(folder: string): Promise<void> {
        if (this._ensuredFolders.includes(folder)) {
            return;
        }

        await this.inspectFolder(path.dirname(folder));

        const folderStat = await exfs.ensureFolder(folder);
        if (folderStat.isSymbolicLink) {
            this.addSymlinkFolder(folder, folderStat.realpath);
        }
        this._ensuredFolders.push(folder);
    }

    public isSymlinkTargetOutsideTargetFolder(linkTarget: string, linkFilePath: string): boolean {
        const fileDir = path.dirname(linkFilePath);
        return exfs.isOutside(this.realTargetFolder, path.resolve(fileDir, linkTarget));
    }

    public async isOutsideTargetFolder(tpath: string): Promise<boolean> {
        if (this._symlinkFileNames.length === 0 && this._symlinkFolders.length === 0) {
            return false;
        }
        if (process.platform === "win32" && this.symlinkAsFileOnWindows) {
            return false;
        }
        for (const { folder, realpath } of this._symlinkFolders) {
            if (tpath.includes(folder)) {
                if (exfs.isOutside(this.realTargetFolder, realpath)) {
                    return true;
                }
            }
        }
        for (const fileName of this._symlinkFileNames) {
            if (tpath.includes(fileName)) {
                const realFilePath = await exfs.realpath(tpath);
                if (exfs.isOutside(this.realTargetFolder, realFilePath)) {
                    return true;
                }
            }
        }
        return false;
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

    private zipFile: yauzl.ZipFile | null = null;
    private token: CancellationToken | null = null;

    /**
     * Extract the zip buffer to the specified location.
     * @param zipBuffer
     * @param targetFolder
     */
    public async extract(zipBuffer: Buffer, targetFolder: string): Promise<void>;
    /**
     * Extract the zip file to the specified location.
     * @param zipFile
     * @param targetFolder
     */
    public async extract(zipFile: string, targetFolder: string): Promise<void>;
    public async extract(zipFileOrBuffer: string | Buffer, targetFolder: string): Promise<void> {
        const token = new CancellationToken();
        this.token = token;

        try {
            const { zfile, realTargetFolder } = await this.prepareExtraction(zipFileOrBuffer, targetFolder, token);
            this.zipFile = zfile;
            await this.processEntries(zfile, targetFolder, realTargetFolder, token);
        } finally {
            if (this.token === token) {
                this.token = null;
            }
        }
    }

    private async prepareExtraction(
        zipFileOrBuffer: string | Buffer,
        targetFolder: string,
        token: CancellationToken,
    ): Promise<{ zfile: yauzl.ZipFile; realTargetFolder: string }> {
        if (this.isOverwrite()) {
            await exfs.rimraf(targetFolder);
        }
        if (token.isCancelled) {
            throw this.canceledError();
        }

        await exfs.ensureFolder(targetFolder);
        const realTargetFolder = await exfs.realpath(targetFolder);
        const zfile = await this.openZip(zipFileOrBuffer, token);

        return { zfile, realTargetFolder };
    }

    private async processEntries(
        zfile: yauzl.ZipFile,
        targetFolder: string,
        realTargetFolder: string,
        token: CancellationToken,
    ): Promise<void> {
        return await new Promise<void>((resolve, reject) => {
            let extractedEntriesCount = 0;
            let anyError: Error | null = null;
            const total = zfile.entryCount;
            const entryContext: IEntryContext = new EntryContext(targetFolder, realTargetFolder, this.symlinkToFile());
            const entryEvent = new EntryEvent(total);
            const settle = this.createPromiseSettler(resolve, reject);
            const disposeCancel = token.onCancelled(() => {
                this.closeZip(zfile);
                settle.reject(this.canceledError());
            });

            zfile.once("error", (err) => {
                disposeCancel();
                anyError = this.wrapError(err, token.isCancelled);
                this.closeZip(zfile);
                settle.reject(anyError);
            });

            zfile.once("close", () => {
                disposeCancel();
                if (this.zipFile === zfile) {
                    this.zipFile = null;
                }
                if (anyError) {
                    settle.reject(this.wrapError(anyError, token.isCancelled));
                } else if (token.isCancelled) {
                    settle.reject(this.canceledError());
                } else if (extractedEntriesCount >= total) {
                    // If the zip content is empty, it will not receive the zfile.on("entry") event.
                    settle.resolve();
                }
            });

            zfile.on("entry", async (entry: yauzl.Entry) => {
                try {
                    await this.handleZipEntry(zfile, entry, entryContext, entryEvent, token);
                    extractedEntriesCount++;
                    if (extractedEntriesCount >= total) {
                        settle.resolve();
                    }
                } catch (error) {
                    anyError = this.wrapError(error, token.isCancelled);
                    this.closeZip(zfile);
                    settle.reject(anyError);
                }
            });

            this.readNextEntry(zfile, token);
        });
    }

    private readNextEntry(zfile: yauzl.ZipFile, token: CancellationToken): void {
        if (token.isCancelled) {
            this.closeZip(zfile);
            return;
        }
        zfile.readEntry();
    }

    private createPromiseSettler(resolve: () => void, reject: (error: Error) => void) {
        let settled = false;

        return {
            resolve: () => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve();
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

    private async handleZipEntry(
        zfile: yauzl.ZipFile,
        entry: yauzl.Entry,
        entryContext: IEntryContext,
        entryEvent: EntryEvent,
        token: CancellationToken,
    ): Promise<void> {
        // use UTF-8 in all situations
        // see https://github.com/thejoshwolfe/yauzl/issues/84
        const rawName = (entry.fileName as unknown as Buffer).toString("utf8");
        // allow backslash
        const fileName = rawName.replace(/\\/g, "/");
        // Because decodeStrings is false, we need to manually verify the entry name
        // see https://github.com/thejoshwolfe/yauzl#validatefilenamefilename
        const errorMessage = yauzl.validateFileName(fileName);
        if (errorMessage != null) {
            throw new Error(errorMessage);
        }

        entryEvent.entryName = fileName;
        this.onEntryCallback(entryEvent);
        entryContext.decodeEntryFileName = fileName;

        if (entryEvent.isPrevented) {
            entryEvent.reset();
            this.readNextEntry(zfile, token);
            return;
        }

        await this.handleEntry(zfile, entry, entryContext, token);
    }

    /**
     * Cancel extraction.
     * If the cancel method is called after the extract is complete, nothing will happen.
     */
    public cancel(): void {
        if (this.token) {
            this.token.cancel();
            this.token = null;
        }
        this.closeZip();
    }

    private closeZip(zfile?: yauzl.ZipFile): void {
        const target = zfile ?? this.zipFile;
        if (target) {
            target.close();
        }
        if (!zfile || this.zipFile === zfile) {
            this.zipFile = null;
        }
    }

    private async openZip(zipFileOrBuffer: string | Buffer, token: CancellationToken): Promise<yauzl.ZipFile> {
        const options: yauzl.Options = {
            lazyEntries: true,
            // see https://github.com/thejoshwolfe/yauzl/issues/84
            decodeStrings: false,
        } as const;

        try {
            return await new Promise<yauzl.ZipFile>((resolve, reject) => {
                const callback = (err: Error | null, zfile: yauzl.ZipFile) => {
                    if (err) {
                        reject(this.wrapError(err, token.isCancelled));
                    } else {
                        resolve(zfile);
                    }
                };

                if (typeof zipFileOrBuffer === "string") {
                    yauzl.open(zipFileOrBuffer, options, callback);
                } else {
                    yauzl.fromBuffer(zipFileOrBuffer, options, callback);
                }
            });
        } catch (error) {
            throw this.wrapError(error, token.isCancelled);
        }
    }

    private async handleEntry(
        zfile: yauzl.ZipFile,
        entry: yauzl.Entry,
        entryContext: IEntryContext,
        token: CancellationToken,
    ): Promise<void> {
        if (/\/$/.test(entryContext.decodeEntryFileName)) {
            // Directory file names end with '/'.
            // Note that entries for directories themselves are optional.
            // An entry's fileName implicitly requires its parent directories to exist.
            await exfs.ensureFolder(entryContext.getFilePath());
            this.readNextEntry(zfile, token);
        } else {
            // file entry
            await this.extractEntry(zfile, entry, entryContext, token);
        }
    }

    private openZipFileStream(zfile: yauzl.ZipFile, entry: yauzl.Entry, token: CancellationToken): Promise<Readable> {
        return new Promise<Readable>((resolve, reject) => {
            zfile.openReadStream(entry, (err, readStream) => {
                if (err) {
                    reject(this.wrapError(err, token.isCancelled));
                } else {
                    resolve(readStream);
                }
            });
        });
    }

    private async extractEntry(
        zfile: yauzl.ZipFile,
        entry: yauzl.Entry,
        entryContext: IEntryContext,
        token: CancellationToken,
    ): Promise<void> {
        const filePath = entryContext.getFilePath();
        const fileDir = path.dirname(filePath);
        await entryContext.inspectFolder(fileDir);
        const outside = await entryContext.isOutsideTargetFolder(fileDir);
        if (outside) {
            const error = new Error(`Refuse to write file outside "${entryContext.targetFolder}", file: "${filePath}"`);
            error.name = "AFWRITE";
            return Promise.reject(error);
        }
        const readStream = await this.openZipFileStream(zfile, entry, token);
        await this.writeEntryToFile(readStream, entry, entryContext, token);
        this.readNextEntry(zfile, token);
    }

    private async writeEntryToFile(
        readStream: Readable,
        entry: yauzl.Entry,
        entryContext: IEntryContext,
        token: CancellationToken,
    ): Promise<void> {
        try {
            const filePath = entryContext.getFilePath();
            const mode = this.modeFromEntry(entry);
            // see https://unix.stackexchange.com/questions/193465/what-file-mode-is-a-symlink
            const isSymlink = (mode & 0o170000) === 0o120000;
            if (isSymlink) {
                entryContext.symlinkFileNames.push(
                    path.resolve(path.join(entryContext.targetFolder, entryContext.decodeEntryFileName)),
                );
            }
            if (isSymlink && !this.symlinkToFile()) {
                const linkContent = await this.readStreamContent(readStream, token);

                if (
                    this.options?.safeSymlinksOnly &&
                    entryContext.isSymlinkTargetOutsideTargetFolder(linkContent, filePath)
                ) {
                    const error = new Error(
                        `Dangerous link path was refused : "${entryContext.targetFolder}", file: "${filePath}", target: "${linkContent}". Set safeSymlinksOnly to false to allow writing through this symlink.`,
                    );
                    error.name = "AF_ILLEGAL_TARGET";
                    throw error;
                }

                await entryContext.ensureFolder(path.dirname(filePath));
                await this.createSymlink(linkContent, filePath);
            } else {
                await entryContext.ensureFolder(path.dirname(filePath));
                const fileStream = createWriteStream(filePath, { mode });
                const pipelinePromise = pipeline(readStream, fileStream);

                const disposeCancel = token.onCancelled(() => {
                    fileStream.destroy(this.canceledError());
                });

                try {
                    await pipelinePromise;
                } finally {
                    disposeCancel();
                }
            }
        } catch (error) {
            throw this.wrapError(error, token.isCancelled);
        }
    }

    private async readStreamContent(readStream: Readable, token: CancellationToken): Promise<string> {
        let linkContent = "";
        const readPromise = new Promise<void>((resolve, reject) => {
            readStream.on("data", (chunk: string | Buffer) => {
                linkContent += typeof chunk === "string" ? chunk : chunk.toString();
            });
            readStream.once("end", resolve);
            readStream.once("error", (err) => {
                reject(this.wrapError(err, token.isCancelled));
            });
        });
        const disposeCancel = token.onCancelled(() => {
            readStream.destroy(this.canceledError());
        });

        try {
            await readPromise;
            return linkContent;
        } finally {
            disposeCancel();
        }
    }

    private modeFromEntry(entry: yauzl.Entry): number {
        const attr = entry.externalFileAttributes >> 16 || 33188;

        return [448 /* S_IRWXU */, 56 /* S_IRWXG */, 7 /* S_IRWXO */]
            .map((mask) => attr & mask)
            .reduce((a, b) => a + b, attr & 61440 /* S_IFMT */);
    }

    private async createSymlink(linkContent: string, filePath: string): Promise<void> {
        let linkType: "dir" | "file" | "junction" | null | undefined = "file";
        if (process.platform === "win32") {
            if (/\/$/.test(linkContent)) {
                linkType = "dir";
            } else {
                let targetPath = linkContent;
                if (!path.isAbsolute(linkContent)) {
                    targetPath = path.join(path.dirname(filePath), linkContent);
                }
                try {
                    const stat = await fs.stat(targetPath);
                    if (stat.isDirectory()) {
                        linkType = "dir";
                    }
                } catch (_error) {
                    // ignore
                }
            }
        }
        await fs.symlink(linkContent, filePath, linkType);
    }

    private isOverwrite(): boolean {
        if (this.options?.overwrite) {
            return true;
        }
        return false;
    }

    private onEntryCallback(event: IEntryEvent): void {
        if (this.options?.onEntry) {
            this.options.onEntry(event);
        }
    }

    private symlinkToFile(): boolean {
        let symlinkToFile: boolean = false;
        if (process.platform === "win32") {
            if (this.options && this.options.symlinkAsFileOnWindows === false) {
                symlinkToFile = false;
            } else {
                symlinkToFile = true;
            }
        }
        return symlinkToFile;
    }
}
