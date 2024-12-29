/**
Capabilities library
To use this on an agent, simply download <sheetbot_baseurl>/scripts/lib/capabilities.ts and rename it to `.capabilities.dynamic.ts
Alternatively, if you don't mind dynamically loading it, create a file `.capabilities.dynamic.ts` with the following content:

async function getCapabilities(staticCapabilities) {
    const lib = await import(Deno.env.get("SHEETBOT_BASEURL") + "/scripts/lib/capabilities.ts");
    return await lib.getCapabilities(staticCapabilities);
}

export { getCapabilities };
*/

import $ from "https://deno.land/x/dax/mod.ts";

function transformToVersion(toolName, version) {
    return {
        [toolName]: {
            version: version,
            major_version: parseInt(version?.split(".")[0] + ""),
            minor_version: parseInt(version?.split(".")[1] + ""),
            patch_version: parseInt(version?.split(".")[2].split('-')[0].split('r')[0] + ""),
        }
    }
}

async function getGenericCmdVersion(cmdName, commandStr) {
    try {
        const cmd = await $(commandStr).text();
        const version = cmd.split('\n').shift()?.split(" ").pop();
        return transformToVersion(cmdName, version);
    } catch (e) {
        // ignore
    }
    return {};
}

async function getGit() {
    return getGenericCmdVersion('git', 'git --version');
}

async function getVirtualbox() {
    return getGenericCmdVersion('virtualbox', 'vboxmanage --version');
}

async function getDeno() {
    return transformToVersion('deno', Deno.version.deno);
}

async function getClang() {
    try {
        const cmd = await $`clang --version`.text();
        const match = Array.from(cmd.matchAll(/clang version (?<version>\S*)/gi))[0];
        const version = match?.groups?.version;
        if (version) {
            return {
                clang: {
                    version: version,
                    major_version: parseInt(version?.split(".")[0] + ""),
                    minor_version: parseInt(version?.split(".")[1] + ""),
                    patch_version: parseInt(version?.split(".")[2].split('-')[0].split('r')[0] + ""),
                }
            }
        }
    } catch (e) {
        // ignore
    }
    return {};
}

async function getCMake() {
    return getGenericCmdVersion('cmake', 'cmake --version');
}

async function getOS() {
    try {
        const version = Deno.osRelease();
        return {
            os: Deno.build.os,
            release: {
                version: version,
                major_version: parseInt(version?.split(".")[0]),
                minor_version: parseInt(version?.split(".")[1]),
                patch_version: parseInt(version?.split(".")[2].split("r")[0]),
            }
        }
    } catch (e) {
        // ignore
    }
    return {};
}

async function getMemory() {
    const memoryInfo = Deno.systemMemoryInfo();
    return {
        total: memoryInfo.total / 1024 / 1024,
        free: memoryInfo.free / 1024 / 1024,
        available: memoryInfo.available / 1024 / 1024,
        unit: 'MB'
    }
}


async function getCapabilities(staticCapabilities) {
    let software = {};
    software = Object.assign(software, await getGit());
    software = Object.assign(software, await getVirtualbox());
    software = Object.assign(software, await getClang());
    software = Object.assign(software, await getCMake());
    software = Object.assign(software, await getDeno());

    let os = {}
    os = Object.assign(os, await getOS());

    let memory = {}
    memory = await getMemory();

    const packages = Array.from(new Set(Object.keys(software).concat(staticCapabilities?.packages || [])));
    return Object.assign({}, staticCapabilities, {
        'hostname': Deno.hostname(),
        'software': software,
        'packages': packages,
        'build': Deno.build,
        'os': os,
        'memory': memory
    });
}

export { getCapabilities };