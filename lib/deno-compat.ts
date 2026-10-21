import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";

function readLineSync(): string {
    const buf = Buffer.alloc(1);
    let data = "";
    while (true) {
        let n = 0;
        try {
            n = fs.readSync(0, buf, 0, 1, null);
        } catch {
            n = 0;
        }
        if (n === 0) break;
        const ch = buf.toString("utf8", 0, n);
        if (ch === "\n") break;
        if (ch !== "\r") data += ch;
    }
    return data;
}

function prompt(message?: any, defaultValue?: any): string | null {
    if (message !== undefined && message !== null) {
        process.stdout.write(String(message));
        if (defaultValue !== undefined) process.stdout.write(` (${defaultValue})`);
    }
    const input = readLineSync();
    if (input === "" && defaultValue !== undefined) return String(defaultValue);
    return input;
}

function promptSecret(message?: any): string | null {
    if (message !== undefined && message !== null) process.stdout.write(String(message));
    return readLineSync();
}

function openFlags(options?: any): string {
    if (!options) return "r";
    if (options.append) return "a";
    if (options.write && options.create && options.createNew) return "wx";
    if (options.write && options.create) return "w";
    if (options.write) return "r+";
    if (options.create) return "r+";
    return "r";
}

const Deno = {
    args: process.argv.slice(2),
    env: {
        get: (key: string) => process.env[key],
        set: (key: string, value: string) => { process.env[key] = value; },
        delete: (key: string) => { delete process.env[key]; },
        has: (key: string) => Object.prototype.hasOwnProperty.call(process.env, key),
        toObject: () => ({ ...process.env }),
    },
    exit: (code: number = 0) => process.exit(code),
    build: { os: process.platform, arch: process.arch },
    version: { deno: "node", typescript: process.version },
    readDirSync: (path: any) => {
        return fs.readdirSync(path, { withFileTypes: true }).map((d: any) => ({
            name: d.name,
            isFile: d.isFile(),
            isDirectory: d.isDirectory(),
            isSymlink: d.isSymbolicLink(),
        }));
    },
    readDir: async function* (path: any) {
        const entries: any = await fsp.readdir(path, { withFileTypes: true });
        for (const d of entries) {
            yield { name: d.name, isFile: d.isFile(), isDirectory: d.isDirectory(), isSymlink: d.isSymbolicLink() };
        }
    },
    readFileSync: (path: any) => fs.readFileSync(path),
    readTextFileSync: (path: any) => fs.readFileSync(path, "utf8"),
    readFile: async (path: any) => fs.promises.readFile(path),
    readTextFile: async (path: any) => fs.promises.readFile(path, "utf8"),
    writeFileSync: (path: any, data: any) => fs.writeFileSync(path, data),
    writeTextFileSync: (path: any, data: any) => fs.writeFileSync(path, data, "utf8"),
    writeFile: async (path: any, data: any) => fs.promises.writeFile(path, data),
    mkdir: async (path: any, options?: any) => { await fs.promises.mkdir(path, options); },
    mkdirSync: (path: any, options?: any) => fs.mkdirSync(path, options),
    remove: async (path: any, options?: any) => { await fs.promises.rm(path, { recursive: options?.recursive, force: true }); },
    removeSync: (path: any, options?: any) => fs.rmSync(path, { recursive: options?.recursive, force: true }),
    rename: async (oldPath: any, newPath: any) => { await fs.promises.rename(oldPath, newPath); },
    renameSync: (oldPath: any, newPath: any) => fs.renameSync(oldPath, newPath),
    copyFile: async (src: any, dest: any) => { await fs.promises.copyFile(src, dest); },
    copyFileSync: (src: any, dest: any) => fs.copyFileSync(src, dest),
    stat: async (path: any) => {
        const s = await fs.promises.stat(path);
        return { isFile: s.isFile(), isDirectory: s.isDirectory(), isSymlink: s.isSymbolicLink(), size: s.size, mtime: s.mtime, atime: s.atime, birthtime: s.birthtime, mode: s.mode };
    },
    statSync: (path: any) => {
        const s = fs.statSync(path);
        return { isFile: s.isFile(), isDirectory: s.isDirectory(), isSymlink: s.isSymbolicLink(), size: s.size, mtime: s.mtime, atime: s.atime, birthtime: s.birthtime, mode: s.mode };
    },
    lstat: async (path: any) => {
        const s = await fs.promises.lstat(path);
        return { isFile: s.isFile(), isDirectory: s.isDirectory(), isSymlink: s.isSymbolicLink(), size: s.size, mtime: s.mtime };
    },
    open: async (path: any, options?: any) => {
        const fd = fs.openSync(path, openFlags(options));
        return {
            read: async (buffer: Uint8Array, offset?: number, length?: number, position?: number | null) => {
                return fs.readSync(fd, buffer as any, offset ?? 0, length ?? buffer.length, position ?? null);
            },
            write: async (data: Uint8Array) => fs.writeSync(fd, data as any),
            close: () => fs.closeSync(fd),
            seek: async () => 0,
        };
    },
    openSync: (path: any, options?: any) => {
        const fd = fs.openSync(path, openFlags(options));
        return {
            read: (buffer: Uint8Array, offset?: number, length?: number, position?: number | null) => fs.readSync(fd, buffer as any, offset ?? 0, length ?? buffer.length, position ?? null),
            write: (data: Uint8Array) => fs.writeSync(fd, data as any),
            close: () => fs.closeSync(fd),
        };
    },
    hostname: () => os.hostname(),
    osRelease: () => os.release(),
    systemMemoryInfo: () => {
        return { total: os.totalmem(), free: os.freemem(), available: os.freemem() };
    },
    loadavg: () => os.loadavg(),
    addSignalListener: (signal: string, handler: () => void) => process.on(signal as any, handler),
};

(globalThis as any).Deno = Deno;
(globalThis as any).prompt = prompt;
(globalThis as any).promptSecret = promptSecret;

declare global {
    var Deno: any;
    function prompt(message?: any, defaultValue?: any): string | null;
    function promptSecret(message?: any): string | null;
}

export {};
