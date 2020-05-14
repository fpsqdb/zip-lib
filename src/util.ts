import * as fs from "fs";
import * as util from "util";

export function unlink(path: fs.PathLike): Promise<void> {
    return util.promisify(fs.unlink)(path);
}

export function mkdir(path: fs.PathLike, mode?: string | number | null | undefined): Promise<void> {
    return util.promisify(fs.mkdir)(path, mode);
}

export function realpath(path: fs.PathLike): Promise<string> {
    return util.promisify(fs.realpath)(path);
}

export function stat(path: fs.PathLike): Promise<fs.Stats> {
    return util.promisify(fs.stat)(path);
}

export function lstat(path: fs.PathLike): Promise<fs.Stats> {
    return util.promisify(fs.lstat)(path);
}

export function chmod(path: fs.PathLike, mode: string | number): Promise<void> {
    return util.promisify(fs.chmod)(path, mode);
}

export function readdir(path: fs.PathLike): Promise<string[]> {
    return util.promisify(fs.readdir)(path);
}

export function access(path: fs.PathLike, mode?: number | undefined): Promise<void> {
    return util.promisify(fs.access)(path, mode);
}

export function rmdir(path: fs.PathLike): Promise<void> {
    return util.promisify(fs.rmdir)(path);
}

export function symlink(target: fs.PathLike, path: fs.PathLike): Promise<void> {
    return util.promisify(fs.symlink)(target, path);
}

export function readlink(path: fs.PathLike): Promise<string> {
    return util.promisify(fs.readlink)(path);
}
