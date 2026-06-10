import "yauzl";

declare module "yauzl" {
    interface ZipFile {
        eachEntry(): AsyncIterableIterator<Entry>;
        openReadStreamPromise(entry: Entry): Promise<Readable>;
        openReadStreamPromise(entry: Entry, options: ZipFileOptions): Promise<Readable>;
    }
    function openPromise(path: string, options: Options): Promise<ZipFile>;
    function fromFdPromise(fd: number, options: Options): Promise<ZipFile>;
    function fromBufferPromise(buffer: Buffer, options: Options): Promise<ZipFile>;
    function fromRandomAccessReaderPromise(
        reader: RandomAccessReader,
        totalSize: number,
        options: Options,
    ): Promise<ZipFile>;
}
