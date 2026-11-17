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
     * Records a symlink file that has been processed.
     * @param filePath
     */
    addSymlinkFileName(filePath: string): void;
    getFilePath(): string;
    /**
     * Inspects the symlink target path.
     * @param linkTarget
     * @param linkFilePath
     */
    isSymlinkTargetOutsideTargetFolder(linkTarget: string, linkFilePath: string): Promise<IOutsideTargetInfo>;
    /**
     * Whether the specified path is outside the target folder.
     * @param tpath
     */
    isOutsideTargetFolder(tpath: string): Promise<IOutsideTargetInfo>;
    inspectFolder(folder: string): Promise<void>;
    ensureFolder(folder: string): Promise<void>;
}

interface IOutsideTargetInfo {
    /**
     * Whether the path is outside the target folder.
     */
    readonly isOutside: boolean;
    /**
     * The path after following the links created by the current extraction.
     * Only meaningful when `isOutside` is `true`.
     */
    readonly resolvedPath: string;
}

class EntryContext implements IEntryContext {
    constructor(
        private _targetFolder: string,
        private _realTargetFolder: string,
        private symlinkAsFileOnWindows: boolean,
    ) {
        this._symlinks = new Map<string, string | undefined>();
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
    /**
     * Symlinks (files and folders) processed so far. The key is the link path, the value
     * is its real path when already known (folder links), `undefined` otherwise (file
     * links). Serves both as a cheap index to decide whether a path can escape through a
     * link and as a cache to skip `fs.realpath` calls.
     */
    private _symlinks: Map<string, string | undefined>;
    private _inspectedFolders: string[];
    private _ensuredFolders: string[];

    private addSymlinkFolder(folder: string, realpath: string): void {
        this._symlinks.set(folder, realpath);
    }

    public addSymlinkFileName(filePath: string): void {
        if (!this._symlinks.has(filePath)) {
            this._symlinks.set(filePath, undefined);
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

    /**
     * Cheap check whether the raw (not yet normalized) path goes through one of the
     * symlinks created by this extraction, without any `fs` call.
     */
    private hasSymlinkInPath(rawPath: string): boolean {
        const root = path.parse(rawPath).root;
        let current = root;
        for (const segment of rawPath.slice(root.length).split(/[\\/]+/)) {
            if (!segment) {
                continue;
            }
            current = current.endsWith(path.sep) ? current + segment : current + path.sep + segment;
            if (this._symlinks.has(current)) {
                return true;
            }
        }
        return false;
    }

    public async isSymlinkTargetOutsideTargetFolder(
        linkTarget: string,
        linkFilePath: string,
    ): Promise<IOutsideTargetInfo> {
        const fileDir = path.dirname(linkFilePath);
        // Keep the target raw here: `path.join` would collapse "l/.." into the link folder
        // itself (e.g. "extract/l/.." -> "extract"), losing the link the kernel follows
        // before handling "..". `path.resolve` below is only used for the textual check.
        const rawTarget = path.isAbsolute(linkTarget) ? linkTarget : `${fileDir}${path.sep}${linkTarget}`;
        const textualTarget = path.resolve(rawTarget);
        if (exfs.isOutside(this.realTargetFolder, textualTarget)) {
            return { isOutside: true, resolvedPath: textualTarget };
        }
        // A target like "link/.." is inside the target folder when ".." is collapsed as
        // text, but the kernel resolves ".." after following the link. Only pay for
        // `fs.realpath` when the target actually goes through a link of this extraction.
        if (this._symlinks.size === 0 || !this.hasSymlinkInPath(rawTarget)) {
            return { isOutside: false, resolvedPath: textualTarget };
        }
        const resolvedPath = await exfs.realpathExistingPrefix(rawTarget);
        if (resolvedPath === undefined) {
            return { isOutside: false, resolvedPath: textualTarget };
        }
        return { isOutside: exfs.isOutside(this.realTargetFolder, resolvedPath), resolvedPath };
    }

    public async isOutsideTargetFolder(tpath: string): Promise<IOutsideTargetInfo> {
        if (this._symlinks.size === 0 || (process.platform === "win32" && this.symlinkAsFileOnWindows)) {
            return { isOutside: false, resolvedPath: tpath };
        }
        const textualTarget = path.resolve(tpath);
        let realpathNeeded = false;
        for (const [symlinkPath, realpath] of this._symlinks) {
            if (exfs.isOutside(symlinkPath, tpath)) {
                continue;
            }
            if (realpath === undefined) {
                realpathNeeded = true;
                continue;
            }
            // The real path of the symlink folder is already known, so the final path
            // can be derived without an extra `fs.realpath` call.
            const resolvedPath = path.join(realpath, path.relative(symlinkPath, tpath));
            if (exfs.isOutside(this.realTargetFolder, resolvedPath)) {
                return { isOutside: true, resolvedPath };
            }
        }
        if (!realpathNeeded) {
            return { isOutside: false, resolvedPath: textualTarget };
        }
        const resolvedPath = (await exfs.realpathExistingPrefix(tpath)) ?? textualTarget;
        return { isOutside: exfs.isOutside(this.realTargetFolder, resolvedPath), resolvedPath };
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
        let currentZFile: yauzl.ZipFile | null = null;

        try {
            const { zfile, realTargetFolder } = await this.prepareExtraction(zipFileOrBuffer, targetFolder, token);
            currentZFile = zfile;
            this.zipFile = zfile;
            await this.processEntries(zfile, targetFolder, realTargetFolder, token);
        } finally {
            if (this.token === token) {
                this.token = null;
            }
            if (this.zipFile && this.zipFile === currentZFile) {
                this.zipFile = null;
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
        const realTargetFolder = await fs.realpath(targetFolder);
        const zfile = await this.openZip(zipFileOrBuffer, token);

        if (token.isCancelled) {
            throw this.canceledError();
        }

        return { zfile, realTargetFolder };
    }

    private async processEntries(
        zfile: yauzl.ZipFile,
        targetFolder: string,
        realTargetFolder: string,
        token: CancellationToken,
    ): Promise<void> {
        try {
            const total = zfile.entryCount;
            const entryContext: IEntryContext = new EntryContext(targetFolder, realTargetFolder, this.symlinkToFile());
            const entryEvent = new EntryEvent(total);
            for await (const entry of zfile.eachEntry()) {
                await this.handleZipEntry(zfile, entry, entryContext, entryEvent, token);
                if (token.isCancelled) {
                    throw this.canceledError();
                }
            }
        } catch (error) {
            throw this.wrapError(error, token.isCancelled);
        }
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
            if (typeof zipFileOrBuffer === "string") {
                return yauzl.openPromise(zipFileOrBuffer, options);
            } else {
                return yauzl.fromBufferPromise(zipFileOrBuffer, options);
            }
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
        } else {
            // file entry
            await this.extractEntry(zfile, entry, entryContext, token);
        }
    }

    private openZipFileStream(zfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
        return zfile.openReadStreamPromise(entry);
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
        const fileTarget = await entryContext.isOutsideTargetFolder(filePath);
        if (fileTarget.isOutside) {
            const error = new Error(
                `Refuse to write file outside "${entryContext.targetFolder}", file: "${filePath}", resolved path: "${fileTarget.resolvedPath}"`,
            );
            error.name = "AFWRITE";
            throw error;
        }
        const readStream = await this.openZipFileStream(zfile, entry);
        await this.writeEntryToFile(readStream, entry, entryContext, token);
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
                entryContext.addSymlinkFileName(
                    path.resolve(path.join(entryContext.targetFolder, entryContext.decodeEntryFileName)),
                );
            }
            if (isSymlink && !this.symlinkToFile()) {
                const linkContent = await this.readStreamContent(readStream, token);

                const linkTarget = this.options?.safeSymlinksOnly
                    ? await entryContext.isSymlinkTargetOutsideTargetFolder(linkContent, filePath)
                    : undefined;
                if (linkTarget?.isOutside) {
                    const error = new Error(
                        `Dangerous link path was refused : "${entryContext.targetFolder}", file: "${filePath}", target: "${linkContent}", resolved target: "${linkTarget.resolvedPath}". Set safeSymlinksOnly to false to allow writing through this symlink.`,
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
        for await (const chunk of readStream) {
            linkContent += typeof chunk === "string" ? chunk : (chunk as Buffer).toString();
            if (token.isCancelled) {
                throw this.canceledError();
            }
        }
        return linkContent;
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
