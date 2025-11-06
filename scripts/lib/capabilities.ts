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
    if (version === undefined) {
        return {}
    }
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
    return await getGenericCmdVersion('git', 'git --version');
}

async function getVirtualbox() {
    return await getGenericCmdVersion('virtualbox', 'vboxmanage --version');
}

function getDeno() {
    return transformToVersion('deno', Deno.version.deno);
}

async function getClang() {
    try {
        const cmd = await $`clang --version`.text();
        const match = Array.from(cmd.matchAll(/clang version (?<version>\S*)/gi))[0];
        const version = match?.groups?.version;
        if (version) {
            return transformToVersion('clang', version);
        }
    } catch (e) {
        // ignore
    }
    return {};
}

async function getScons() {
    try {
        const cmd = await $`scons --version`.text();
        const match = Array.from(cmd.matchAll(/SCons: v(?<version>[\.a-zA-Z0-9]*)/gi))[0];
        const version = match?.groups?.version;
        if (version) {
            return transformToVersion('scons', version);
        }
    } catch (e) {
        // ignore
    }
    return {};
}

async function getCMake() {
    return await getGenericCmdVersion('cmake', 'cmake --version');
}

function getOS() {
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

function getMemory() {
    const memoryInfo = Deno.systemMemoryInfo();
    return {
        total: memoryInfo.total / 1024 / 1024,
        free: memoryInfo.free / 1024 / 1024,
        available: memoryInfo.available / 1024 / 1024,
        unit: 'MB'
    }
}

function getLoadAvg() {
    const loadAvg = Deno.loadavg();
    return {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2]
    }
}

async function getLinuxInfo() {
    const osReleaseText = await Deno.readTextFile("/etc/os-release");
    const prettyName = Array.from(osReleaseText.matchAll(/PRETTY_NAME\=\"(?<prettyName>.+)\"/gi))[0]?.groups?.prettyName;
    const name = Array.from(osReleaseText.matchAll(/^NAME\=\"(?<name>.+)\"/gim))[0]?.groups?.name;
    const versionCodename = Array.from(osReleaseText.matchAll(/VERSION_CODENAME\=(?<codename>.+)/gi))[0]?.groups?.codename;
    const version = Array.from(osReleaseText.matchAll(/VERSION\=\"(?<version>.+)\"/gi))[0]?.groups?.version;
    const versionId = Array.from(osReleaseText.matchAll(/VERSION_ID\=\"(?<versionId>.+)\"/gi))[0]?.groups?.versionId;
    const versionNum = Array.from(version?.matchAll(/(?<versionNum>[0-9]+\.[0-9]+\.[0-9])/gi))[0]?.groups?.versionNum;
    const rel = transformToVersion("release", versionNum);
    return Object.assign({}, rel, {
        "pretty_name": prettyName,
        "name": name,
        "versionCodename": versionCodename,
        "versionId": versionId
    });
}


async function getCapabilities(staticCapabilities) {
    let software = {};
    software = Object.assign(software, await getGit());
    software = Object.assign(software, await getVirtualbox());
    software = Object.assign(software, await getClang());
    software = Object.assign(software, await getCMake());
    software = Object.assign(software, getDeno());
    software = Object.assign(software, await getScons());

    let os: Record<string, unknown> = {}
    os = Object.assign(os, getOS());

    let linux = undefined;
    let windows = undefined;
    if (os.os === "linux") {
        linux = await getLinuxInfo();
    }

    let memory = {}
    memory = getMemory();

    let     loadavg = getLoadAvg();

    const packages = Array.from(new Set(Object.keys(software).concat(staticCapabilities?.packages || [])));
    return Object.assign({}, staticCapabilities, {
        'hostname': Deno.hostname(),
        'software': software,
        'packages': packages,
        'build': Deno.build,
        'os': os,
        'memory': memory,
        'loadavg': loadavg,
        'linux': linux,
        'windows': windows
    });
}

export { getCapabilities };