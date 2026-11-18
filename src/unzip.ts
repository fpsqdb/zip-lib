import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as yauzl from "yauzl";
import { Cancelable, CancellationToken } from "./cancelable";
import * as exfs from "./fs";

// `O_NOFOLLOW` is not available on Windows: it is `undefined` there and the flag is ignored.
// Where it is available, the kernel refuses to open a link at the target path, so writing a
// file needs no `fs.lstat` before it is opened.
const canRefuseLinkAtOpen: boolean = typeof constants.O_NOFOLLOW === "number";
const writeOpenFlags: number =
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (canRefuseLinkAtOpen ? constants.O_NOFOLLOW : 0);

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
    /**
     * Inspects the target path and its parents on disk and records the links found.
     * @param target
     */
    inspectPath(target: string): Promise<void>;
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
    ) {
        this._links = new Set<string>();
        this._inspectedPaths = [];
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
     * Links found on disk so far, including dangling ones and links left by a previous
     * extraction. Serves as a cheap index to decide whether a path can escape through a
     * link, the link itself is always resolved from disk when needed.
     */
    private _links: Set<string>;
    /**
     * Paths already inspected on disk. Only paths that exist are recorded: a path that
     * does not exist yet can still become a link later on.
     */
    private _inspectedPaths: string[];
    private _ensuredFolders: string[];

    public getFilePath(): string {
        return path.resolve(path.join(this.targetFolder, this.decodeEntryFileName));
    }

    public async inspectPath(target: string): Promise<void> {
        if (this._inspectedPaths.includes(target) || target === path.dirname(target)) {
            return;
        }

        await this.inspectPath(path.dirname(target));

        let targetStat: Awaited<ReturnType<typeof fs.lstat>>;
        try {
            // `fs.lstat` does not follow the link, so a dangling link is still reported as a link.
            targetStat = await fs.lstat(target);
        } catch (error) {
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                (error.code === "ENOENT" || error.code === "ENOTDIR")
            ) {
                return;
            }
            throw error;
        }
        if (targetStat.isSymbolicLink()) {
            this._links.add(target);
        }
        this._inspectedPaths.push(target);
    }

    public async ensureFolder(folder: string): Promise<void> {
        if (this._ensuredFolders.includes(folder)) {
            return;
        }

        await this.inspectPath(path.dirname(folder));

        const folderStat = await exfs.ensureFolder(folder);
        if (folderStat.isSymbolicLink) {
            this._links.add(folder);
        }
        this._inspectedPaths.push(folder);
        this._ensuredFolders.push(folder);
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
        // A target like "link/.." is inside the target folder when ".." is collapsed as text,
        // but the kernel resolves ".." after following the links in front of it, which may even
        // be links that this extraction did not create. This is only reached for symlink entries
        // with `safeSymlinksOnly`, so the resolution is not on the hot path.
        const resolvedPath = await exfs.realpathExistingPrefix(rawTarget);
        if (resolvedPath === undefined) {
            return { isOutside: false, resolvedPath: textualTarget };
        }
        return { isOutside: exfs.isOutside(this.realTargetFolder, resolvedPath), resolvedPath };
    }

    public async isOutsideTargetFolder(tpath: string): Promise<IOutsideTargetInfo> {
        // Applies on every platform: the links are read from disk, so a link that a previous
        // extraction left on Windows is seen as well. `symlinkAsFileOnWindows` only decides how
        // the links of this archive are created, not whether the ones on disk are followed.
        if (this._links.size === 0) {
            return { isOutside: false, resolvedPath: tpath };
        }
        const textualTarget = path.resolve(tpath);
        let linkOnPath: boolean = false;
        for (const linkPath of this._links) {
            if (!exfs.isOutside(linkPath, tpath)) {
                linkOnPath = true;
                break;
            }
        }
        if (!linkOnPath) {
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
            const entryContext: IEntryContext = new EntryContext(targetFolder, realTargetFolder);
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
            const folderPath = entryContext.getFilePath();
            await entryContext.inspectPath(folderPath);
            const folderTarget = await entryContext.isOutsideTargetFolder(folderPath);
            // `ensureFolder` follows the links in the path, so it can create the folder outside
            // the target folder. A folder that already exists is only re-used, nothing is created,
            // so only a folder that would actually be created is refused.
            if (folderTarget.isOutside && !(await exfs.statFolder(folderPath))) {
                const error = new Error(
                    `Refuse to create folder outside "${entryContext.targetFolder}", folder: "${folderPath}", resolved path: "${folderTarget.resolvedPath}"`,
                );
                error.name = "AFWRITE";
                throw error;
            }
            // Creates the folder by following the links in the path, which is why a folder that
            // would be created outside the target folder is rejected above.
            await entryContext.ensureFolder(folderPath);
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
        await entryContext.inspectPath(fileDir);
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
                // Record the link from disk so that later entries see it.
                await entryContext.inspectPath(filePath);
            } else {
                await entryContext.ensureFolder(path.dirname(filePath));
                const fileStream = (await this.openWriteStream(filePath, mode, entryContext)).createWriteStream();
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

    /**
     * Opens the target file without following a link, so that a link at the target path is never
     * written through, even when it points outside the target folder or was left there by a
     * previous extraction.
     */
    private async openWriteStream(
        filePath: string,
        mode: number,
        entryContext: IEntryContext,
    ): Promise<fs.FileHandle> {
        if (!canRefuseLinkAtOpen) {
            await this.removeLinkAtTarget(filePath, entryContext);
        }
        try {
            return await fs.open(filePath, writeOpenFlags, mode);
        } catch (error) {
            // ELOOP on POSIX, EMLINK on some of the BSDs: the kernel refused to follow a link.
            const code = (error as NodeJS.ErrnoException).code;
            if (!canRefuseLinkAtOpen || (code !== "ELOOP" && code !== "EMLINK")) {
                throw error;
            }
            await this.removeLinkAtTarget(filePath, entryContext);
            return await fs.open(filePath, writeOpenFlags, mode);
        }
    }

    /**
     * Replaces a link at the target path with the regular file that is about to be written, like
     * `unzip`/7-Zip do: only the link is removed, the path it points to is left untouched. A link
     * that resolves outside the target folder is refused instead.
     */
    private async removeLinkAtTarget(filePath: string, entryContext: IEntryContext): Promise<void> {
        let isSymlink: boolean = false;
        try {
            isSymlink = (await fs.lstat(filePath)).isSymbolicLink();
        } catch (error) {
            if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
                return;
            }
            throw error;
        }
        if (!isSymlink) {
            return;
        }

        const resolvedPath = (await exfs.realpathExistingPrefix(filePath)) ?? filePath;
        if (exfs.isOutside(entryContext.realTargetFolder, resolvedPath)) {
            const error = new Error(
                `Refuse to write file outside "${entryContext.targetFolder}", file: "${filePath}", resolved path: "${resolvedPath}"`,
            );
            error.name = "AFWRITE";
            throw error;
        }
        // Removing the link is safe: `fs.unlink` drops the link itself, not its target.
        await fs.unlink(filePath);
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
