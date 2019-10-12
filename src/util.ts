
import * as fs from "fs";
import * as util from "util";

function nfcall(fn: Function, ...args: any[]): any {
    return new Promise((c, e) => fn(...args, (err: any, result: any) => err ? e(err) : c(result)));
}

export function unlink(path: fs.PathLike): Promise<void> {
    if (typeof util.promisify === "function") {
        return util.promisify(fs.unlink)(path);
    } else {
        return nfcall(fs.unlink, path);
    }
}

export function mkdir(path: fs.PathLike, mode?: string | number | null | undefined): Promise<void> {
    if (typeof util.promisify === "function") {
        return util.promisify(fs.mkdir)(path, mode);
    } else {
        return nfcall(fs.mkdir, path, mode);
    }
}

export function lstat(path: fs.PathLike): Promise<fs.Stats> {
    if (typeof util.promisify === "function") {
        return util.promisify(fs.lstat)(path);
    } else {
        return nfcall(fs.lstat, path);
    }
}

export function chmod(path: fs.PathLike, mode: string | number): Promise<void> {
    if (typeof util.promisify === "function") {
        return util.promisify(fs.chmod)(path, mode);
    } else {
        return nfcall(fs.chmod, path, mode);
    }
}

export function readdir(path: fs.PathLike): Promise<string[]> {
    if (typeof util.promisify === "function") {
        return util.promisify(fs.readdir)(path);
    } else {
        return nfcall(fs.readdir, path);
    }
}

export function access(path: fs.PathLike, mode?: number | undefined): Promise<void> {
    if (typeof util.promisify === "function") {
        return util.promisify(fs.access)(path, mode);
    } else {
        return nfcall(fs.access, path, mode);
    }
}

export function rmdir(path: fs.PathLike): Promise<void> {
    if (typeof util.promisify === "function") {
        return util.promisify(fs.rmdir)(path);
    } else {
        return nfcall(fs.rmdir, path);
    }
}

export function symlink(target: fs.PathLike, path: fs.PathLike): Promise<void> {
    if (typeof util.promisify === "function") {
        return util.promisify(fs.symlink)(target, path);
    } else {
        return nfcall(fs.symlink, target, path);
    }
}

export function readlink(path: fs.PathLike): Promise<string> {
    if (typeof util.promisify === "function") {
        return util.promisify(fs.readlink)(path);
    } else {
        return nfcall(fs.readlink, path);
    }
}
