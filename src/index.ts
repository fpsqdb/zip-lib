import { type IExtractOptions, Unzip } from "./unzip";
import { type IZipOptions, Zip } from "./zip";

export * from "./unzip";
export * from "./zip";

/**
 * Compress a single file to a buffer.
 * @param file
 * @param options
 */
export function archiveFile(file: string, options?: IZipOptions): Promise<Buffer>;
/**
 * Compress a single file to the specified zip file path.
 * @param file
 * @param zipFile the zip file path.
 * @param options
 */
export function archiveFile(file: string, zipFile: string, options?: IZipOptions): Promise<void>;
export function archiveFile(
    file: string,
    zipFile?: string | IZipOptions,
    options?: IZipOptions,
): Promise<void | Buffer> {
    let optionsParameter: IZipOptions | undefined;
    if (typeof zipFile === "string") {
        optionsParameter = options;
    } else if (typeof zipFile === "object") {
        optionsParameter = zipFile;
    }
    const zip = new Zip(optionsParameter);
    zip.addFile(file);
    if (typeof zipFile === "string") {
        return zip.archive(zipFile);
    }
    return zip.archive();
}

/**
 * Compress all the contents of the specified folder to a buffer.
 * @param folder
 * @param options
 */
export function archiveFolder(folder: string, options?: IZipOptions): Promise<Buffer>;
/**
 * Compress all the contents of the specified folder to the specified zip file path.
 * @param folder
 * @param zipFile the zip file path.
 * @param options
 */
export function archiveFolder(folder: string, zipFile: string, options?: IZipOptions): Promise<void>;
export function archiveFolder(
    folder: string,
    zipFile?: string | IZipOptions,
    options?: IZipOptions,
): Promise<void | Buffer> {
    let optionsParameter: IZipOptions | undefined;
    if (typeof zipFile === "string") {
        optionsParameter = options;
    } else if (typeof zipFile === "object") {
        optionsParameter = zipFile;
    }
    const zip = new Zip(optionsParameter);
    zip.addFolder(folder);
    if (typeof zipFile === "string") {
        return zip.archive(zipFile);
    }
    return zip.archive();
}

/**
 * Extract the zip buffer to the specified location.
 * @param zipBuffer
 * @param targetFolder
 * @param options
 */
export function extract(zipBuffer: Buffer, targetFolder: string, options?: IExtractOptions): Promise<void>;
/**
 * Extract the zip file to the specified location.
 * @param zipFile
 * @param targetFolder
 * @param options
 */
export function extract(zipFile: string, targetFolder: string, options?: IExtractOptions): Promise<void>;
export function extract(
    zipFileOrBuffer: string | Buffer,
    targetFolder: string,
    options?: IExtractOptions,
): Promise<void> {
    const unzip = new Unzip(options);
    // biome-ignore lint/suspicious/noExplicitAny: <>
    return unzip.extract(zipFileOrBuffer as any, targetFolder);
}
