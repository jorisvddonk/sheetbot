import { addSheetData, getSheetData } from "./sheetutil.ts";
import { uploadArtefactFromFilepath } from "./taskutil.ts";

export const DEFAULT_REPO = "/Users/joris/projects/Noctis-IV-Plus";
export const ENGINES = ["orig", "rust", "lr"];
export const SHEET_STARS = "nivgen_stars";
export const SHEET_PLANETS = "nivgen_planets";
export const SHEET_RUNS = "nivgen_runs";

export interface Coords {
  x: number;
  y: number;
  z: number;
}

export interface StarEntry {
  name: string;
  cls: number;
  x: number;
  y: number;
  z: number;
}

export interface PlanetSurface {
  type: number;
  isMoon: boolean;
  surf?: string;
  atmo?: string;
  pal?: string;
  seedval?: number;
}

export interface SectorHashes {
  hm: string;
  oc: string;
  gap?: string;
}

export interface TextureHashes {
  stex: string;
  sky: string;
}

export interface RunResult {
  ok: number;
  total: number;
  summary: string;
}

const PLANET_ALL_RE = /^PLANET (\d+) type=(\d+) is_moon=(\d+) surf=(\w+) atmo=(\w+) pal=(\w+)/gm;
const PLANET_SEED_RE = /^PLANET body=(\d+) type=(\d+)[^\n]*owner=(-?\d+) seedval=([-\d.]+)/gm;
const CANON_BLOCK_RE = /^PLANET body=/m;

function hashRe(label: string): RegExp {
  return new RegExp(`^${label}\\s+len=\\d+\\s+fnv=(\\w+)`, "m");
}
const GAP_RE = /^gap\s+len=16\s+([0-9A-F]{32})/m;

export function hashOf(text: string, label: string): string | undefined {
  const m = text.match(hashRe(label));
  return m ? m[1] : undefined;
}

export function gapOf(text: string): string | undefined {
  const m = text.match(GAP_RE);
  return m ? m[1] : undefined;
}

export function parsePlanetAll(text: string): Map<number, PlanetSurface> {
  const out = new Map<number, PlanetSurface>();
  for (const m of text.matchAll(PLANET_ALL_RE)) {
    out.set(parseInt(m[1], 10), {
      type: parseInt(m[2], 10),
      isMoon: m[3] === "1",
      surf: m[4],
      atmo: m[5],
      pal: m[6],
    });
  }
  return out;
}

export function parsePlanetSeed(text: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const m of text.matchAll(PLANET_SEED_RE)) {
    out.set(parseInt(m[1], 10), parseFloat(m[4]));
  }
  return out;
}

export function parseCanonicalPlanets(text: string): Map<number, PlanetSurface> {
  const out = new Map<number, PlanetSurface>();
  const parts = text.split(CANON_BLOCK_RE).slice(1);
  for (const block of parts) {
    const hdr = /^(\d+) type=(\d+).*?owner=(-?\d+).*?seedval=([-\d.]+)/.exec(block);
    if (!hdr) continue;
    const body = parseInt(hdr[1], 10);
    out.set(body, {
      type: parseInt(hdr[2], 10),
      isMoon: parseInt(hdr[3], 10) > -1,
      seedval: parseFloat(hdr[4]),
      surf: hashOf(block, "surface_map"),
      atmo: hashOf(block, "atmo_overlay"),
      pal: hashOf(block, "palette64"),
    });
  }
  return out;
}

export function parseSectorOutput(text: string): SectorHashes {
  const hm = hashOf(text, "heightmap");
  const oc = hashOf(text, "objectchart");
  return { hm: hm || "", oc: oc || "", gap: gapOf(text) };
}

export function parseTextureOutput(text: string): TextureHashes {
  const stex = hashOf(text, "surf_texture");
  const sky = hashOf(text, "sky_texture");
  return { stex: stex || "", sky: sky || "" };
}

export function coordsFromSeedval(seedval: number): { lon: number; lat: number } {
  const s = Math.abs(Math.round(seedval));
  return {
    lon: s % 360,
    lat: 1 + Math.floor(s / 1000) % 119,
  };
}

export function planetKey(star: string, body: number): string {
  return `${star}|${body}`;
}

export async function sheetRows(sheet: string): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  let json: { columns?: { name: string }[]; rows?: unknown[][] };
  try {
    json = await getSheetData(sheet);
  } catch {
    return out;
  }
  const cols = (json.columns || []).map((c) => c.name);
  for (const row of json.rows || []) {
    const obj: Record<string, unknown> = {};
    cols.forEach((name, i) => {
      obj[name] = (row as unknown[])[i];
    });
    const key = String(obj["key"] ?? (row as unknown[])[0] ?? "");
    if (key) out.set(key, obj);
  }
  return out;
}

export async function upsertSheet(sheet: string, key: string, data: Record<string, unknown>): Promise<void> {
  await addSheetData(sheet, { key, ...data });
}

export function loadStarmap2(repoDir: string): StarEntry[] {
  const path = `${repoDir}/data/starmap2.bin`;
  const data = Deno.readFileSync(path);
  const byName = new Map<string, StarEntry>();
  const ENTRY = 44;
  for (let i = 0; i + ENTRY <= data.length; i += ENTRY) {
    const ent = data.subarray(i, i + ENTRY);
    const view = new DataView(ent.buffer, ent.byteOffset, ent.byteLength);
    const idx = view.getInt32(12, true);
    if (idx !== 0) continue;
    const x = view.getInt32(0, true);
    const yEng = view.getInt32(4, true);
    const z = view.getInt32(8, true);
    const bodyType = view.getInt32(16, true);
    if (bodyType !== 0) continue;
    const name = new TextDecoder().decode(ent.subarray(20, 40)).replace(/ +$/, "");
    const typeStr = new TextDecoder().decode(ent.subarray(40, 44)).replace(/ +$/, "");
    if (!name || !typeStr.startsWith(" S")) continue;
    byName.set(name, {
      name,
      cls: parseInt(typeStr.slice(2, 4), 10),
      x,
      y: -yEng,
      z,
    });
  }
  return [...byName.values()];
}

export async function runCmd(
  program: string,
  args: string[],
  cwd: string,
  opts: { env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const cmd = new Deno.Command(program, {
    args,
    cwd,
    env: opts.env,
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  let stdout = "";
  let stderr = "";
  let timer: number | undefined;
  if (opts.timeoutMs) {
    timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, opts.timeoutMs);
  }
  const enc = new TextEncoder();
  const pump = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    sink: (s: string) => void,
  ): Promise<void> => {
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const s = dec.decode(value, { stream: true });
      sink(s);
    }
  };
  await Promise.all([
    pump(child.stdout.getReader(), (s) => {
      stdout += s;
      try {
        Deno.stdout.writeSync(enc.encode(s));
      } catch {
        // ignore
      }
    }),
    pump(child.stderr.getReader(), (s) => {
      stderr += s;
      try {
        Deno.stderr.writeSync(enc.encode(s));
      } catch {
        // ignore
      }
    }),
  ]);
  if (timer) clearTimeout(timer);
  const status = await child.status;
  return { code: status.code, stdout, stderr };
}

export function findExecutable(name: string, envVar?: string): string | undefined {
  if (envVar && Deno.env.get(envVar)) return Deno.env.get(envVar)!;
  try {
    const r = new Deno.Command("which", { args: [name], stdout: "piped", stderr: "piped" }).outputSync();
    if (r.code === 0) {
      return new TextDecoder().decode(r.stdout).trim();
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function nivgenPath(repoDir: string): string {
  return `${repoDir}/tests/nivgen/target/release/nivgen`;
}

export function requireNivgen(repoDir: string): string {
  const p = nivgenPath(repoDir);
  try {
    Deno.statSync(p);
  } catch {
    throw new Error(`nivgen binary not found at ${p} - build it with: cd tests/nivgen && cargo build --release`);
  }
  return p;
}

export async function runNivgen(
  repoDir: string,
  args: string[],
  opts: { env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<string> {
  const bin = requireNivgen(repoDir);
  const r = await runCmd(bin, args, repoDir, opts);
  if (r.code !== 0) {
    throw new Error(`nivgen ${args.join(" ")} failed (code ${r.code}): ${r.stderr.slice(-500)}`);
  }
  return r.stdout + r.stderr;
}

export function toolchainMount(repoDir: string): string | undefined {
  const base = Deno.env.get("TOOLCHAIN") || `${repoDir}/niv-toolchain/BCPP31`;
  if (existsSync(`${base}/BIN/BCC.EXE`)) return base;
  if (existsSync(`${base}/TC/BIN/BCC.EXE`)) return `${base}/TC`;
  return undefined;
}

export function harnessExeDir(repoDir: string): string {
  return `${repoDir}/tests/.harness_build`;
}

export function harnessExePath(repoDir: string): string {
  return `${harnessExeDir(repoDir)}/NIVTEST.EXE`;
}

function existsSync(p: string): boolean {
  try {
    Deno.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function harnessSources(repoDir: string): string[] {
  const out: string[] = [];
  const add = (p: string) => out.push(p);
  add(`${repoDir}/tests/harness/NIVTEST.CPP`);
  add(`${repoDir}/tests/harness/NIVHASH.C`);
  add(`${repoDir}/tests/harness/NIVHASH.H`);
  add(`${repoDir}/tests/harness/NIVSTUBS.C`);
  add(`${repoDir}/source/NOCTIS-0.CPP`);
  add(`${repoDir}/source/NOCTIS-1.CPP`);
  add(`${repoDir}/tests/dosbox/BUILD.BAT`);
  add(`${repoDir}/tests/dosbox/LINK.RSP`);
  for (const f of Deno.readDirSync(`${repoDir}/source`)) {
    if (f.isFile && (f.name.endsWith(".h") || f.name.endsWith(".H"))) add(`${repoDir}/source/${f.name}`);
  }
  return [...new Set(out)];
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeSourceHash(repoDir: string): Promise<string> {
  const parts: Uint8Array[] = [];
  for (const f of harnessSources(repoDir).sort()) {
    if (existsSync(f)) {
      parts.push(Deno.readFileSync(f));
    } else {
      parts.push(new TextEncoder().encode("MISSING:" + f));
    }
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return await sha256Hex(buf);
}

export async function ensureHarness(
  repoDir: string,
  opts: { force?: boolean; build?: boolean } = {},
): Promise<void> {
  const exe = harnessExePath(repoDir);
  const hashFile = `${harnessExeDir(repoDir)}/NIVTEST.EXE.srchash`;
  const cur = await computeSourceHash(repoDir);
  let need = opts.force || opts.build || !existsSync(exe);
  if (!need) {
    try {
      need = Deno.readTextFileSync(hashFile).trim() !== cur;
    } catch {
      need = true;
    }
  }
  if (!need) return;

  const tc = toolchainMount(repoDir);
  if (!tc) {
    throw new Error(`Borland toolchain not found (looked in niv-toolchain/BCPP31)`);
  }
  const dosboxX = findExecutable("dosbox-x", "DOSBOX_X");
  if (!dosboxX) {
    throw new Error("dosbox-x not found on PATH (brew install dosbox-x)");
  }

  const work = await Deno.makeTempDir({ prefix: "nivgen_build_" });
  try {
    const copy = (src: string) => {
      if (existsSync(src)) Deno.copyFileSync(src, `${work}/${src.split("/").pop()}`);
    };
    for (const f of harnessSources(repoDir)) copy(f);
    Deno.mkdirSync(harnessExeDir(repoDir), { recursive: true });
    const conf = [
      "[cpu]",
      "cputype=486",
      "cycles=max",
      "[dos]",
      "xms=true",
      "ems=true",
      "[autoexec]",
      `mount c ${tc}`,
      `mount d ${work}`,
      `mount e ${harnessExeDir(repoDir)}`,
      "path C:\\BIN",
      "d:",
      "call BUILD.BAT",
      "if exist BUILD.FAIL goto end",
      "copy D:\\NIVTEST.EXE E:\\",
      ":end",
      "exit",
    ].join("\r\n");
    Deno.writeTextFileSync(`${work}/build.conf`, conf);
    await runCmd(dosboxX, ["-conf", `${work}/build.conf`, "-exit"], repoDir, {
      env: { SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy" },
      timeoutMs: 20 * 60 * 1000,
    });
    if (!existsSync(exe)) {
      const log = `${work}/BUILD.LOG`;
      const tail = existsSync(log) ? Deno.readTextFileSync(log).slice(-1000) : "(no build log)";
      throw new Error(`NIVTEST.EXE build FAILED:\n${tail}`);
    }
    Deno.writeTextFileSync(hashFile, cur + "\n");
  } finally {
    try {
      Deno.removeSync(work, { recursive: true });
    } catch {
      // ignore
    }
  }
}

export async function dosboxRun(
  repoDir: string,
  runLines: string[],
  opts: { timeoutMs?: number; subdirs?: string[] } = {},
): Promise<string> {
  const tc = toolchainMount(repoDir);
  if (!tc) throw new Error("Borland toolchain not found");
  const dosboxX = findExecutable("dosbox-x", "DOSBOX_X");
  if (!dosboxX) throw new Error("dosbox-x not found on PATH");

  const work = await Deno.makeTempDir({ prefix: "nivgen_run_" });
  for (const d of opts.subdirs ?? []) {
    Deno.mkdirSync(`${work}/${d}`, { recursive: true });
  }
  const run = [...runLines, "exit"].join("\r\n") + "\r\n";
  Deno.writeTextFileSync(`${work}/RUN.BAT`, run);
  const conf = [
    "[cpu]",
    "cputype=486",
    "cycles=max",
    "core=dynamic",
    "[dos]",
    "xms=true",
    "ems=true",
    "[sdl]",
    "startup_verbosity=quiet",
    "[autoexec]",
    `mount c ${tc}`,
    `mount d ${work}`,
    `mount e ${harnessExeDir(repoDir)}`,
    "path C:\\BIN;E:\\",
    "d:",
    "copy E:\\NIVTEST.EXE D:\\NIVTEST.EXE >NUL",
    "if exist BUILD.FAIL goto end",
    "call RUN.BAT",
    ":end",
    "exit",
  ].join("\r\n");
  Deno.writeTextFileSync(`${work}/niv.conf`, conf);
  const r = await runCmd(dosboxX, ["-conf", `${work}/niv.conf`, "-exit"], repoDir, {
    env: { SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy" },
    timeoutMs: opts.timeoutMs ?? 30 * 60 * 1000,
  });
  if (existsSync(`${work}/BUILD.FAIL`)) {
    const log = `${work}/BUILD.LOG`;
    const tail = existsSync(log) ? Deno.readTextFileSync(log).slice(-500) : "";
    try {
      Deno.removeSync(work, { recursive: true });
    } catch {
      // ignore
    }
    throw new Error(`DOSBox build FAILED:\n${tail}\nstderr: ${r.stderr.slice(-500)}`);
  }
  return work;
}

function crc32(buf: Uint8Array): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function zlibCompress(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function indexedToPng(
  width: number,
  height: number,
  idx: Uint8Array,
  lut: Uint8Array,
): Promise<Uint8Array> {
  const stride = width * 3;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = (stride + 1) * y;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const v = idx[y * width + x] & 63;
      const p = v * 3;
      raw[rowStart + 1 + x * 3] = lut[p];
      raw[rowStart + 1 + x * 3 + 1] = lut[p + 1];
      raw[rowStart + 1 + x * 3 + 2] = lut[p + 2];
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = await zlibCompress(raw);
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function colorLut(palette: Uint8Array, base: number): Uint8Array {
  const lut = new Uint8Array(192);
  for (let i = 0; i < 64; i++) {
    const o = base + i * 3;
    lut[i * 3] = Math.min(255, Math.round(palette[o] * 4.05));
    lut[i * 3 + 1] = Math.min(255, Math.round(palette[o + 1] * 4.05));
    lut[i * 3 + 2] = Math.min(255, Math.round(palette[o + 2] * 4.05));
  }
  return lut;
}

async function uploadPng(
  data: Uint8Array,
  filename: string,
): Promise<string | undefined> {
  const f = await Deno.makeTempFile({ prefix: "nivgen_png_" });
  try {
    await Deno.writeFile(f, data);
    const a = await uploadArtefactFromFilepath(f, filename);
    return a.directURL || a.url;
  } finally {
    try {
      await Deno.remove(f);
    } catch {
      // ignore
    }
  }
}

function textureDims(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length === 65536) return { width: 256, height: 256 };
  if (bytes.length === 65024) return { width: 256, height: 254 };
  if (bytes.length === 64800) return { width: 360, height: 180 };
  const side = Math.floor(Math.sqrt(bytes.length));
  return { width: side, height: Math.floor(bytes.length / side) };
}

export async function getPalette(
  repoDir: string,
  coords: Coords,
  body: number,
  lon: number,
  lat: number,
): Promise<Uint8Array> {
  const dir = await Deno.makeTempDir({ prefix: "nivgen_pal_" });
  try {
    await runNivgen(repoDir, ["surftex", "-x", String(coords.x), "-y", String(coords.y), "-z", String(coords.z),
      "-p", String(body), "-lon", String(lon), "-lat", String(lat)], { env: { NIVDUMP: dir } });
    const pal = `${dir}/palette.raw`;
    if (existsSync(pal)) {
      return Deno.readFileSync(pal);
    }
    return new Uint8Array(768);
  } finally {
    try {
      Deno.removeSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }
}

export async function getPlanetPalette(
  repoDir: string,
  coords: Coords,
  body: number,
): Promise<Uint8Array> {
  const dir = await Deno.makeTempDir({ prefix: "nivgen_pal_" });
  try {
    await runNivgen(repoDir, ["planet", "-x", String(coords.x), "-y", String(coords.y), "-z", String(coords.z),
      "-p", String(body)], { env: { NIVDUMP: dir } });
    const pal = `${dir}/palette.raw`;
    if (existsSync(pal)) {
      return Deno.readFileSync(pal);
    }
    return new Uint8Array(768);
  } finally {
    try {
      Deno.removeSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }
}

export async function dumpTexture(
  repoDir: string,
  dumpDir: string,
  prefix: string,
  opts: { palette?: Uint8Array } = {},
): Promise<{ stex?: string; sky?: string }> {
  const names: string[] = [];
  try {
    for (const f of Deno.readDirSync(dumpDir)) {
      if (f.isFile) names.push(f.name);
    }
  } catch {
    return {};
  }
  const stexFile = names.find((n) => /^surftex\.bin$/i.test(n));
  const skyFile = names.find((n) => /^sky\.bin$/i.test(n));
  let palette = opts.palette;
  if (!palette) {
    const palFile = names.find((n) => /^palette\.raw$/i.test(n));
    if (palFile) {
      try {
        palette = Deno.readFileSync(`${dumpDir}/${palFile}`);
      } catch {
        // ignore
      }
    }
  }
  const out: { stex?: string; sky?: string } = {};
  const render = async (file: string | undefined, kind: "surftex" | "sky"): Promise<string | undefined> => {
    if (!file) return undefined;
    try {
      const bytes = Deno.readFileSync(`${dumpDir}/${file}`);
      const rawName = `${prefix}_${kind}.bin`;
      await uploadArtefactFromFilepath(`${dumpDir}/${file}`, rawName).catch(() => undefined);
      if (palette && palette.length >= 253) {
        const { width, height } = textureDims(bytes);
        const lut = kind === "surftex" ? colorLut(palette, 0) : colorLut(palette, 192);
        const png = await indexedToPng(width, height, bytes.subarray(0, width * height), lut);
        return await uploadPng(png, `${prefix}_${kind}.png`);
      }
      return undefined;
    } catch {
      return undefined;
    }
  };
  out.stex = await render(stexFile, "surftex");
  out.sky = await render(skyFile, "sky");
  return out;
}

export async function renderSurfacePng(
  mapBytes: Uint8Array,
  palette: Uint8Array,
  isMoon: boolean,
  filename: string,
): Promise<string | undefined> {
  const map = mapBytes.subarray(0, 360 * 180);
  if (map.length < 360 * 180) return undefined;
  const base = isMoon ? 384 : 576;
  const png = await indexedToPng(360, 180, map, colorLut(palette, base));
  try {
    return await uploadPng(png, filename);
  } catch {
    return undefined;
  }
}

export async function dumpSurface(
  repoDir: string,
  coords: Coords,
  body: number,
  isMoon: boolean,
  prefix: string,
): Promise<string | undefined> {
  const dir = await Deno.makeTempDir({ prefix: "nivgen_surf_" });
  try {
    await runNivgen(repoDir, ["planet", "-x", String(coords.x), "-y", String(coords.y), "-z", String(coords.z),
      "-p", String(body)], { env: { NIVDUMP: dir } });
    const mapFile = isMoon ? "moonsurf.raw" : "surface.raw";
    const mapPath = `${dir}/${mapFile}`;
    if (!existsSync(mapPath)) return undefined;
    const map = Deno.readFileSync(mapPath);
    const pal = Deno.readFileSync(`${dir}/palette.raw`);
    return await renderSurfacePng(map, pal, isMoon, `${prefix}_surface_${body}.png`);
  } finally {
    try {
      Deno.removeSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }
}

export async function rustEngine(
  repoDir: string,
  coords: Coords,
  opts: { gapDef?: string; gapRand?: string; dump?: boolean } = {},
): Promise<{
  planets: Map<number, PlanetSurface>;
  sectors: Map<number, { def: SectorHashes; rand: SectorHashes }>;
  textures: Map<number, { def: TextureHashes; rand: TextureHashes }>;
  dumps: Map<number, { def: { stex?: string; sky?: string }; rand: { stex?: string; sky?: string } }>;
  surfaces: Map<number, string>;
}> {
  const base = ["-x", String(coords.x), "-y", String(coords.y), "-z", String(coords.z)];
  const allText = await runNivgen(repoDir, ["planet-all", ...base]);
  const planets = parsePlanetAll(allText);
  const seeds = new Map<number, number>();
  for (const body of planets.keys()) {
    const t = await runNivgen(repoDir, ["planet", ...base, "-p", String(body)]);
    for (const [b, sv] of parsePlanetSeed(t)) {
      seeds.set(b, sv);
      const p = planets.get(b);
      if (p) p.seedval = sv;
    }
  }
  const sectors = new Map<number, { def: SectorHashes; rand: SectorHashes }>();
  const textures = new Map<number, { def: TextureHashes; rand: TextureHashes }>();
  const dumps = new Map<number, { def: { stex?: string; sky?: string }; rand: { stex?: string; sky?: string } }>();
  const workDump = opts.dump ? await Deno.makeTempDir({ prefix: "nivgen_dump_" }) : undefined;
  try {
    for (const [body, p] of planets) {
      const { lon, lat } = coordsFromSeedval(p.seedval ?? 0);
      const defArgs = [...base, "-p", String(body), "-lon", "0", "-lat", "60"];
      const randArgs = [...base, "-p", String(body), "-lon", String(lon), "-lat", String(lat)];
      const defGap = opts.gapDef;
      const randGap = opts.gapRand;
      if (workDump) {
        Deno.mkdirSync(`${workDump}/def_${body}`, { recursive: true });
        Deno.mkdirSync(`${workDump}/rand_${body}`, { recursive: true });
      }
      const def = parseSectorOutput(await runNivgen(repoDir, ["sector", ...defArgs, ...(defGap ? ["-gap", defGap] : [])]));
      const rand = parseSectorOutput(await runNivgen(repoDir, ["sector", ...randArgs, ...(randGap ? ["-gap", randGap] : [])]));
      sectors.set(body, { def, rand });
      const defTex = parseTextureOutput(
        await runNivgen(repoDir, ["surftex", ...defArgs, ...(defGap ? ["-gap", defGap] : [])], {
          env: workDump ? { NIVDUMP: `${workDump}/def_${body}` } : undefined,
        }),
      );
      const randTex = parseTextureOutput(
        await runNivgen(repoDir, ["surftex", ...randArgs, ...(randGap ? ["-gap", randGap] : [])], {
          env: workDump ? { NIVDUMP: `${workDump}/rand_${body}` } : undefined,
        }),
      );
      textures.set(body, { def: defTex, rand: randTex });
    }
    if (workDump) {
      for (const [body, p] of planets) {
        const { lon, lat } = coordsFromSeedval(p.seedval ?? 0);
        const defPrefix = `rust_def_${body}_${0}_${60}`;
        const randPrefix = `rust_rand_${body}_${lon}_${lat}`;
        const defDump = await dumpTexture(repoDir, `${workDump}/def_${body}`, defPrefix);
        const randDump = await dumpTexture(repoDir, `${workDump}/rand_${body}`, randPrefix);
        dumps.set(body, { def: defDump, rand: randDump });
      }
    }
  } finally {
    if (workDump) {
      try {
        Deno.removeSync(workDump, { recursive: true });
      } catch {
        // ignore
      }
    }
  }
  const surfaces = new Map<number, string>();
  for (const [body, p] of planets) {
    const url = await dumpSurface(repoDir, coords, body, p.isMoon, "rust");
    if (url) surfaces.set(body, url);
  }
  return { planets, sectors, textures, dumps, surfaces };
}

export async function origEngine(
  repoDir: string,
  coords: Coords,
  opts: { timeoutMs?: number; build?: boolean; force?: boolean } = {},
): Promise<{
  planets: Map<number, PlanetSurface>;
  sectors: Map<number, { def: SectorHashes; rand: SectorHashes }>;
  textures: Map<number, { def: TextureHashes; rand: TextureHashes }>;
  dumps: Map<number, { def: { stex?: string; sky?: string }; rand: { stex?: string; sky?: string } }>;
  surfaces: Map<number, string>;
}> {
  await ensureHarness(repoDir, { force: opts.force, build: opts.build });
  const base = `-x ${coords.x} -y ${coords.y} -z ${coords.z}`;
  const work1 = await dosboxRun(repoDir, [
    `NIVTEST.EXE planet-all ${base} -o D:\\STAR.OUT`,
    "if exist STAR.OUT echo OK > D:\\RUN.OK",
  ], opts);
  let planets: Map<number, PlanetSurface>;
  try {
    if (!existsSync(`${work1}/STAR.OUT`)) {
      throw new Error("NIVTEST planet-all produced no output");
    }
    planets = parseCanonicalPlanets(Deno.readTextFileSync(`${work1}/STAR.OUT`));
  } finally {
    try {
      Deno.removeSync(work1, { recursive: true });
    } catch {
      // ignore
    }
  }
  if (planets.size === 0) {
    return { planets, sectors: new Map(), textures: new Map(), dumps: new Map(), surfaces: new Map() };
  }
  const bodies = [...planets.keys()].sort((a, b) => a - b);
  const CHUNK = 12;
  const sectors = new Map<number, { def: SectorHashes; rand: SectorHashes }>();
  const textures = new Map<number, { def: TextureHashes; rand: TextureHashes }>();
  const dumps = new Map<number, { def: { stex?: string; sky?: string }; rand: { stex?: string; sky?: string } }>();
  const surfaces = new Map<number, string>();
  for (let start = 0; start < bodies.length; start += CHUNK) {
    const chunk = bodies.slice(start, start + CHUNK);
    const runLines: string[] = [];
    const dumpDirs: string[] = [];
    const landings = new Map<number, { def: [number, number]; rand: [number, number] }>();
    for (const body of chunk) {
      const p = planets.get(body);
      const { lon, lat } = coordsFromSeedval(p?.seedval ?? 0);
      landings.set(body, { def: [0, 60], rand: [lon, lat] });
      const [dlon, dlat] = landings.get(body)!.def;
      const [rlon, rlat] = landings.get(body)!.rand;
      runLines.push(`NIVTEST.EXE sector ${base} -p ${body} -lon ${dlon} -lat ${dlat} -o D:\\s${body}D.out`);
      runLines.push(`NIVTEST.EXE sector ${base} -p ${body} -lon ${rlon} -lat ${rlat} -o D:\\s${body}R.out`);
      runLines.push(`NIVTEST.EXE surftex ${base} -p ${body} -lon ${dlon} -lat ${dlat} -o D:\\t${body}D.out -dump D:\\dd${body}D`);
      runLines.push(`NIVTEST.EXE surftex ${base} -p ${body} -lon ${rlon} -lat ${rlat} -o D:\\t${body}R.out -dump D:\\dd${body}R`);
      runLines.push(`NIVTEST.EXE planet ${base} -p ${body} -o D:\\p${body}.out -dump D:\\ps${body}`);
      dumpDirs.push(`dd${body}D`, `dd${body}R`, `ps${body}`);
    }
    const work = await dosboxRun(repoDir, runLines, { ...opts, subdirs: dumpDirs });
    try {
      for (const body of chunk) {
        const p = planets.get(body);
        const defS = parseSectorOutput(Deno.readTextFileSync(`${work}/s${body}D.out`));
        const randS = parseSectorOutput(Deno.readTextFileSync(`${work}/s${body}R.out`));
        sectors.set(body, { def: defS, rand: randS });
        const defT = parseTextureOutput(Deno.readTextFileSync(`${work}/t${body}D.out`));
        const randT = parseTextureOutput(Deno.readTextFileSync(`${work}/t${body}R.out`));
        textures.set(body, { def: defT, rand: randT });
        const [dlon, dlat] = landings.get(body)!.def;
        const [rlon, rlat] = landings.get(body)!.rand;
        const defPal = await getPalette(repoDir, coords, body, dlon, dlat);
        const randPal = await getPalette(repoDir, coords, body, rlon, rlat);
        const defDump = await dumpTexture(repoDir, `${work}/dd${body}D`, `orig_def_${body}_${dlon}_${dlat}`, { palette: defPal });
        const randDump = await dumpTexture(repoDir, `${work}/dd${body}R`, `orig_rand_${body}_${rlon}_${rlat}`, { palette: randPal });
        dumps.set(body, { def: defDump, rand: randDump });
        let surfUrl: string | undefined;
        try {
          for (const f of Deno.readDirSync(`${work}/ps${body}`)) {
            if (f.isFile && /^surfmap\.bin$/i.test(f.name)) {
              const map = Deno.readFileSync(`${work}/ps${body}/${f.name}`);
              const pal = await getPlanetPalette(repoDir, coords, body);
              surfUrl = await renderSurfacePng(map, pal, p.isMoon, `orig_surface_${body}.png`);
              break;
            }
          }
        } catch {
          // ignore
        }
        if (surfUrl) surfaces.set(body, surfUrl);
      }
    } finally {
      try {
        Deno.removeSync(work, { recursive: true });
      } catch {
        // ignore
      }
    }
  }
  return { planets, sectors, textures, dumps, surfaces };
}

export function lrNivtestPath(repoDir: string): string {
  const base = Deno.env.get("NIVLR_DIR") || `${repoDir}/../noctis-iv-lr`;
  const bin = `${base}/build/nivtest`;
  if (!existsSync(bin)) {
    throw new Error(`noctis-iv-lr nivtest binary not found at ${bin} - build it with cmake/make in ${base}`);
  }
  return bin;
}

export async function runNivtest(
  repoDir: string,
  args: string[],
  opts: { env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<string> {
  const bin = lrNivtestPath(repoDir);
  const r = await runCmd(bin, args, repoDir, opts);
  if (r.code !== 0) {
    throw new Error(`nivtest ${args.join(" ")} failed (code ${r.code}): ${r.stderr.slice(-500)}`);
  }
  return r.stdout + r.stderr;
}

export async function lrEngine(
  repoDir: string,
  coords: Coords,
  opts: { gapDef?: string; gapRand?: string } = {},
): Promise<{
  planets: Map<number, PlanetSurface>;
  sectors: Map<number, { def: SectorHashes; rand: SectorHashes }>;
  textures: Map<number, { def: TextureHashes; rand: TextureHashes }>;
  dumps: Map<number, { def: { stex?: string; sky?: string }; rand: { stex?: string; sky?: string } }>;
  surfaces: Map<number, string>;
}> {
  const base = ["-x", String(coords.x), "-y", String(coords.y), "-z", String(coords.z)];
  const allText = await runNivtest(repoDir, ["planet-all", ...base]);
  const planets = parsePlanetAll(allText);
  const surfaces = new Map<number, string>();
  for (const body of planets.keys()) {
    const dir = await Deno.makeTempDir({ prefix: "nivlr_surf_" });
    try {
      try {
        const t = await runNivtest(repoDir, ["planet", ...base, "-p", String(body), "-dump", dir]);
        for (const [b, sp] of parseCanonicalPlanets(t)) {
          const pp = planets.get(b);
          if (pp && sp.seedval !== undefined) pp.seedval = sp.seedval;
        }
        const p = planets.get(body);
        const mapPath = `${dir}/surfmap.bin`;
        if (p && existsSync(mapPath)) {
          const map = Deno.readFileSync(mapPath);
          const pal = await getPlanetPalette(repoDir, coords, body);
          const url = await renderSurfacePng(map, pal, p.isMoon, `lr_surface_${body}.png`);
          if (url) surfaces.set(body, url);
        }
      } catch (e) {
        console.error(`lr: body ${body} planet failed, skipping: ${(e as Error).message}`);
        planets.delete(body);
      }
    } finally {
      try {
        Deno.removeSync(dir, { recursive: true });
      } catch {
        // ignore
      }
    }
  }
  const sectors = new Map<number, { def: SectorHashes; rand: SectorHashes }>();
  const textures = new Map<number, { def: TextureHashes; rand: TextureHashes }>();
  const dumps = new Map<number, { def: { stex?: string; sky?: string }; rand: { stex?: string; sky?: string } }>();
  for (const [body, p] of planets) {
    if (p.seedval === undefined) continue;
    try {
      const { lon, lat } = coordsFromSeedval(p.seedval);
      const defArgs = [...base, "-p", String(body), "-lon", "0", "-lat", "60"];
      const randArgs = [...base, "-p", String(body), "-lon", String(lon), "-lat", String(lat)];
      const defGap = opts.gapDef;
      const randGap = opts.gapRand;
      const def = parseSectorOutput(await runNivtest(repoDir, ["sector", ...defArgs, ...(defGap ? ["-gap", defGap] : [])]));
      const rand = parseSectorOutput(await runNivtest(repoDir, ["sector", ...randArgs, ...(randGap ? ["-gap", randGap] : [])]));
      sectors.set(body, { def, rand });
      const defDir = await Deno.makeTempDir({ prefix: "nivlr_tex_" });
      const randDir = await Deno.makeTempDir({ prefix: "nivlr_tex_" });
      try {
        const defTex = parseTextureOutput(
          await runNivtest(repoDir, ["surftex", ...defArgs, ...(defGap ? ["-gap", defGap] : []), "-dump", defDir]),
        );
        const randTex = parseTextureOutput(
          await runNivtest(repoDir, ["surftex", ...randArgs, ...(randGap ? ["-gap", randGap] : []), "-dump", randDir]),
        );
        textures.set(body, { def: defTex, rand: randTex });
        const defPal = await getPalette(repoDir, coords, body, 0, 60);
        const randPal = await getPalette(repoDir, coords, body, lon, lat);
        const defDump = await dumpTexture(repoDir, defDir, `lr_def_${body}_0_60`, { palette: defPal });
        const randDump = await dumpTexture(repoDir, randDir, `lr_rand_${body}_${lon}_${lat}`, { palette: randPal });
        dumps.set(body, { def: defDump, rand: randDump });
      } finally {
        try {
          Deno.removeSync(defDir, { recursive: true });
          Deno.removeSync(randDir, { recursive: true });
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error(`lr: body ${body} sector/surftex failed, skipping: ${(e as Error).message}`);
    }
  }
  return { planets, sectors, textures, dumps, surfaces };
}

export async function nextPendingStar(
  repoDir: string,
  engine: string,
): Promise<string | undefined> {
  let stars = await sheetRows(SHEET_STARS);
  if (stars.size === 0) {
    await importStars(repoDir);
    stars = await sheetRows(SHEET_STARS);
  }
  if (stars.size === 0) return undefined;
  const planets = await sheetRows(SHEET_PLANETS);
  for (const [name, starRow] of stars) {
    const prefix = `${name}|`;
    const rows = [...planets.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v);
    const attempted = rows.some((r) => r[`${engine}_surf`]) ||
      (starRow[`${engine}_attempted`] !== undefined && starRow[`${engine}_attempted`] !== null) ||
      (starRow[`${engine}_failed`] !== undefined && starRow[`${engine}_failed`] !== null);
    if (!attempted) return name;
  }
  return undefined;
}

export async function importStars(repoDir: string): Promise<{ imported: number; skipped: number }> {
  const stars = loadStarmap2(repoDir);
  const existing = await sheetRows(SHEET_STARS);
  let imported = 0;
  let skipped = 0;
  for (const s of stars) {
    if (existing.has(s.name)) {
      skipped++;
      continue;
    }
    await upsertSheet(SHEET_STARS, s.name, {
      name: s.name,
      class: s.cls,
      x: s.x,
      y: s.y,
      z: s.z,
      updated_at: new Date().toISOString(),
    });
    imported++;
  }
  return { imported, skipped };
}

export async function ensureStarInSheet(repoDir: string, name: string): Promise<StarEntry> {
  const stars = await sheetRows(SHEET_STARS);
  const row = stars.get(name);
  if (row && row.x !== undefined && row.y !== undefined && row.z !== undefined) {
    return {
      name,
      cls: Number(row.class ?? 0),
      x: Number(row.x),
      y: Number(row.y),
      z: Number(row.z),
    };
  }
  const entry = loadStarmap2(repoDir).find((s) => s.name === name);
  if (!entry) throw new Error(`star '${name}' not found in starmap2.bin`);
  await upsertSheet(SHEET_STARS, name, {
    name,
    class: entry.cls,
    x: entry.x,
    y: entry.y,
    z: entry.z,
    updated_at: new Date().toISOString(),
  });
  return entry;
}

export async function origExplore(
  repoDir: string,
  coords: Coords,
  sub: string,
  opts: { extra?: string; build?: boolean; force?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  await ensureHarness(repoDir, { force: opts.force, build: opts.build });
  const base = `-x ${coords.x} -y ${coords.y} -z ${coords.z}`;
  const extra = opts.extra ? ` ${opts.extra}` : "";
  const work = await dosboxRun(repoDir, [
    `NIVTEST.EXE ${sub} ${base}${extra} -o D:\\OUT`,
    "if exist OUT echo OK > D:\\RUN.OK",
  ], { timeoutMs: opts.timeoutMs });
  try {
    if (!existsSync(`${work}/OUT`)) return "";
    return Deno.readTextFileSync(`${work}/OUT`);
  } finally {
    try {
      Deno.removeSync(work, { recursive: true });
    } catch {
      // ignore
    }
  }
}

export async function addRun(
  data: Record<string, unknown>,
): Promise<void> {
  await upsertSheet(SHEET_RUNS, new Date().toISOString(), data);
}
