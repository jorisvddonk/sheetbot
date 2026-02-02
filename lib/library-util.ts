export function getLibraryPaths(): string[] {
    const paths = ["./library/"];
    const envPaths = Deno.env.get("SHEETBOT_LIBRARY_SEARCH_PATH");
    if (envPaths) {
        paths.push(...envPaths.split(":").filter(p => p.trim()));
    }
    return paths;
}

export function* getLibraryScripts() {
    for (const path of getLibraryPaths()) {
        try {
            for (const entry of Deno.readDirSync(path)) {
                if (entry.isFile && (entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".py") || entry.name.endsWith(".sh"))) {
                    yield { name: entry.name, path };
                }
            }
        } catch {
            // Skip paths that don't exist or aren't accessible
        }
    }
}
