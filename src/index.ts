import { Zip, IZipOptions } from "./zip";
import { Unzip, IExtractOptions } from "./unzip";
export * from "./zip";
export * from "./unzip";

/**
 * Compress a single file to zip.
 * @param file 
 * @param zipFile the zip file path.
 * @param options 
 */
export function archiveFile(file: string, zipFile: string, options?: IZipOptions): Promise<void> {
    const zip = new Zip(options);
    zip.addFile(file);
    return zip.archive(zipFile);
}

/**
 * Compress all the contents of the specified folder to zip.
 * @param folder 
 * @param zipFile the zip file path. 
 * @param options 
 */
export function archiveFolder(folder: string, zipFile: string, options?: IZipOptions): Promise<void> {
    const zip = new Zip(options);
    zip.addFolder(folder);
    return zip.archive(zipFile);
}

/**
 * Extract the zip file to the specified location.
 * @param zipFile 
 * @param targetFolder 
 * @param options 
 */
export function extract(zipFile: string, targetFolder: string, options?: IExtractOptions): Promise<void> {
    const unzip = new Unzip(options);
    return unzip.extract(zipFile, targetFolder);
}
