import { getData, submitData, uploadArtefactFromFilepath } from "./lib/taskutil.ts";
import {
  DEFAULT_REPO,
  ENGINES,
  SHEET_PLANETS,
  SHEET_STARS,
  addRun,
  coordsFromSeedval,
  ensureStarInSheet,
  importStars,
  lrEngine,
  nextPendingStar,
  origEngine,
  origExplore,
  planetKey,
  runNivgen,
  runNivtest,
  rustEngine,
  sheetRows,
  upsertSheet,
} from "./lib/nivgen_common.ts";

/*
Suggested name for this task: <name>NIVGen</name>

AddTaskComments: <addTaskComments>
Runs the Noctis-IV-Plus universe generator through one of several engine
implementations, with all state stored in SheetBot sheets (nivgen_stars,
nivgen_planets, nivgen_runs).

Actions:
  stars   - populate the star catalog from data/starmap2.bin (engine ignored)
  verify  - generate hashes + textures for one star (or `batch` stars) with the
            selected engine; write full hashes, rand landing coords and texture
            artefact URLs into the planets sheet; report on-the-fly matches vs
            other engines present in the sheet
  explore - one-shot: run the generator for specific inputs and return output
            without touching the sheets

Engines:
  orig - the original C harness compiled with BCPP 3.1, run under DOSBox-X
         (needs dosbox-x on PATH + niv-toolchain/BCPP31 in the repo)
  rust - the deterministic Rust port (tests/nivgen/target/release/nivgen;
         build it first with `cargo build --release`)
  lr   - the noctis-iv-lr port's headless nivtest harness
         (build/nivtest in the sibling ../noctis-iv-lr checkout, or set
         NIVLR_DIR to override the lr repo path)
  more engines can be added later (linoleum, ...)

Data fields:
  engine  (default "rust")      engine to run
  action  (default "verify")    stars | verify | explore
  repoDir (default "/Users/joris/projects/Noctis-IV-Plus")  local repo checkout
  star    star name (verify/explore); auto-selects next pending star if empty
  x/y/z   explicit coords (explore; or overrides star lookup)
  body/lon/lat                 explore inputs for sector/surftex
  sub     (default "system")    explore subcommand: system|planet-all|sector|surftex
  force/build                   rebuild the DOSBox harness even if unchanged
  batch   (default 1)           number of stars to process per verify run

Prerequisites: a checkout of Noctis-IV-Plus at repoDir; for rust the compiled
nivgen binary; for orig dosbox-x and the BCPP31 toolchain.
</addTaskComments>

Suggested data for this task: <data>
{
  "engine": "rust",
  "action": "verify",
  "repoDir": "/Users/joris/projects/Noctis-IV-Plus",
  "star": "",
  "x": null,
  "y": null,
  "z": null,
  "body": null,
  "lon": null,
  "lat": null,
  "sub": "system",
  "force": false,
  "build": false,
  "batch": 1
}
</data>

Suggested capabilitiesSchema for this task: <capabilitiesSchema>
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "os": {
      "anyOf": [
        { "const": "darwin" },
        {
          "type": "object",
          "properties": {
            "os": { "const": "darwin" }
          },
          "required": ["os"]
        }
      ]
    }
  },
  "required": ["os"]
}
</capabilitiesSchema>

Suggested transitions for this task: <transitions>
[
  {
    "statuses": ["COMPLETED"],
    "condition": {},
    "timing": { "every": "15m" },
    "transitionTo": "AWAITING"
  }
]
</transitions>
*/

async function uploadLog(log: string): Promise<string | undefined> {
  try {
    const f = await Deno.makeTempFile({ prefix: "nivgen_", suffix: ".log" });
    await Deno.writeTextFile(f, log);
    const a = await uploadArtefactFromFilepath(f, `nivgen_${Date.now()}.log`);
    await Deno.remove(f).catch(() => {});
    return a.directURL || a.url;
  } catch {
    return undefined;
  }
}

function pickOtherEngine(row: Record<string, unknown>, engine: string): string | undefined {
  for (const e of ENGINES) {
    if (e !== engine && row[`${e}_surf`]) return e;
  }
  return undefined;
}

const MATCH_FIELDS = [
  "surf", "atmo", "pal",
  "sect_def_hm", "sect_def_oc", "sect_rand_hm", "sect_rand_oc",
  "sect_def_sky", "sect_def_stex", "sect_rand_sky", "sect_rand_stex",
];

function matchAgainst(
  row: Record<string, unknown>,
  engine: string,
  other: string,
): { compared: number; mismatches: string[] } {
  const mismatches: string[] = [];
  let compared = 0;
  for (const f of MATCH_FIELDS) {
    const mine = row[`${engine}_${f}`];
    const ref = row[`${other}_${f}`];
    if (mine !== undefined && ref !== undefined) {
      compared++;
      if (mine !== ref) mismatches.push(f);
    }
  }
  return { compared, mismatches };
}

async function actionStars(repoDir: string, log: string[]): Promise<Record<string, unknown>> {
  const { imported, skipped } = await importStars(repoDir);
  log.push(`STARS: ${imported} imported, ${skipped} already present`);
  await addRun({ action: "stars", result: "OK", summary: log[log.length - 1] });
  return { action: "stars", imported, skipped };
}

async function verifyStar(
  repoDir: string,
  engine: string,
  name: string,
  data: Record<string, unknown>,
  log: string[],
): Promise<{ ok: number; total: number; lines: string[] }> {
  const star = await ensureStarInSheet(repoDir, name);
  const coords = { x: star.x, y: star.y, z: star.z };
  log.push(`VERIFY ${name} engine=${engine} @ (${coords.x},${coords.y},${coords.z})`);

  const before = await sheetRows(SHEET_PLANETS);
  let gapDef: string | undefined;
  let gapRand: string | undefined;
  if (engine === "rust" || engine === "lr") {
    const row = before.get(planetKey(name, 0));
    if (row && row["orig_sect_def_gap"]) gapDef = String(row["orig_sect_def_gap"]);
    if (row && row["orig_sect_rand_gap"]) gapRand = String(row["orig_sect_rand_gap"]);
  }

  let result: {
    planets: Map<number, { type: number; isMoon: boolean; seedval?: number; surf?: string; atmo?: string; pal?: string }>;
    sectors: Map<number, { def: { hm: string; oc: string; gap?: string }; rand: { hm: string; oc: string; gap?: string } }>;
    textures: Map<number, { def: { stex: string; sky: string }; rand: { stex: string; sky: string } }>;
    dumps: Map<number, { def: { stex?: string; sky?: string }; rand: { stex?: string; sky?: string } }>;
    surfaces: Map<number, string>;
  };
  if (engine === "rust") {
    result = await rustEngine(repoDir, coords, { gapDef, gapRand, dump: true });
  } else if (engine === "lr") {
    result = await lrEngine(repoDir, coords, { gapDef, gapRand });
  } else if (engine === "orig") {
    result = await origEngine(repoDir, coords, { build: !!data.build, force: !!data.force });
  } else {
    throw new Error(`unknown engine '${engine}' (known: ${ENGINES.join(", ")})`);
  }

  for (const [body, p] of result.planets) {
    const { lon, lat } = coordsFromSeedval(p.seedval ?? 0);
    const def = result.sectors.get(body)?.def;
    const rand = result.sectors.get(body)?.rand;
    const defT = result.textures.get(body)?.def;
    const randT = result.textures.get(body)?.rand;
    const defD = result.dumps.get(body)?.def;
    const randD = result.dumps.get(body)?.rand;
    const surfaceUrl = result.surfaces.get(body);

    const row: Record<string, unknown> = {
      star: name,
      body,
      type: p.type,
      is_moon: p.isMoon ? 1 : 0,
      seedval: p.seedval,
      rand_lon: lon,
      rand_lat: lat,
      updated_at: new Date().toISOString(),
    };
    if (surfaceUrl) row[`${engine}_surface_url`] = surfaceUrl;
    if (p.type !== 10) {
      row[`${engine}_surf`] = p.surf;
      row[`${engine}_atmo`] = p.atmo;
      row[`${engine}_pal`] = p.pal;
    }
    if (def) {
      row[`${engine}_sect_def_hm`] = def.hm || undefined;
      row[`${engine}_sect_def_oc`] = def.oc || undefined;
      row[`${engine}_sect_def_gap`] = def.gap;
    }
    if (rand) {
      row[`${engine}_sect_rand_hm`] = rand.hm || undefined;
      row[`${engine}_sect_rand_oc`] = rand.oc || undefined;
      row[`${engine}_sect_rand_gap`] = rand.gap;
    }
    if (defT) {
      row[`${engine}_sect_def_stex`] = defT.stex || undefined;
      row[`${engine}_sect_def_sky`] = defT.sky || undefined;
    }
    if (randT) {
      row[`${engine}_sect_rand_stex`] = randT.stex || undefined;
      row[`${engine}_sect_rand_sky`] = randT.sky || undefined;
    }
    if (defD) {
      row[`${engine}_sect_def_stex_url`] = defD.stex;
      row[`${engine}_sect_def_sky_url`] = defD.sky;
    }
    if (randD) {
      row[`${engine}_sect_rand_stex_url`] = randD.stex;
      row[`${engine}_sect_rand_sky_url`] = randD.sky;
    }
    await upsertSheet(SHEET_PLANETS, planetKey(name, body), row);
  }

  const after = await sheetRows(SHEET_PLANETS);
  let ok = 0;
  const lines: string[] = [];
  for (const [body] of result.planets) {
    const full = after.get(planetKey(name, body));
    if (!full) continue;
    const other = pickOtherEngine(full, engine);
    if (!other) {
      lines.push(`  body ${String(body).padStart(3)}: stored (no other engine reference yet)`);
      continue;
    }
    const m = matchAgainst(full, engine, other);
    if (m.compared === 0) {
      lines.push(`  body ${String(body).padStart(3)}: no ${other} reference`);
    } else if (m.mismatches.length === 0) {
      ok++;
      lines.push(`  body ${String(body).padStart(3)}: OK vs ${other} (${m.compared} hashes)`);
    } else {
      lines.push(`  body ${String(body).padStart(3)}: DIFF vs ${other} ${m.mismatches.join(" ")}`);
    }
  }
  const total = result.planets.size;
  log.push(`  ${name}: ${ok}/${total} bodies match another engine`);
  await upsertSheet(SHEET_STARS, name, { [`${engine}_attempted`]: new Date().toISOString() });
  return { ok, total, lines };
}

async function actionVerify(
  repoDir: string,
  engine: string,
  data: Record<string, unknown>,
  log: string[],
): Promise<Record<string, unknown>> {
  const batch = Math.max(1, Number(data.batch ?? 1));
  const explicit = String(data.star ?? "").trim();

  let ok = 0;
  let total = 0;
  const report: string[] = [];
  let processed = 0;
  while (processed < batch) {
    const name = explicit || (await nextPendingStar(repoDir, engine));
    if (!name) break;
    const r = await verifyStar(repoDir, engine, name, data, log);
    ok += r.ok;
    total += r.total;
    report.push(`${name}: ${r.ok}/${r.total}`);
    await addRun({ action: "verify", engine, star: name, result: "OK", ok_bodies: r.ok, total_bodies: r.total });
    processed++;
    if (explicit) break;
  }
  if (report.length === 0) {
    log.push(`VERIFY: no star needs processing for engine '${engine}'`);
    await addRun({ action: "verify", engine, result: "OK", summary: "no star needs processing" });
    return { action: "verify", engine, ok: 0, total: 0, note: "no star needs processing" };
  }
  const summary = report.join(" | ");
  log.push(`VERIFY DONE: ${summary}`);
  return { action: "verify", engine, ok, total, summary, stars: report };
}

async function actionExplore(
  repoDir: string,
  engine: string,
  data: Record<string, unknown>,
  log: string[],
): Promise<Record<string, unknown>> {
  const sub = String(data.sub ?? "system");
  let coords: { x: number; y: number; z: number };
  if (data.x !== null && data.x !== undefined && data.y !== null && data.y !== undefined && data.z !== null && data.z !== undefined) {
    coords = { x: Number(data.x), y: Number(data.y), z: Number(data.z) };
  } else if (String(data.star ?? "").trim()) {
    const star = await ensureStarInSheet(repoDir, String(data.star).trim());
    coords = { x: star.x, y: star.y, z: star.z };
  } else {
    throw new Error("explore requires star name or explicit x/y/z");
  }
  log.push(`EXPLORE ${sub} engine=${engine} @ (${coords.x},${coords.y},${coords.z})`);

  let output: string;
  if (engine === "rust") {
    const args = ["-x", String(coords.x), "-y", String(coords.y), "-z", String(coords.z)];
    if (data.body !== null && data.body !== undefined) args.push("-p", String(data.body));
    if (data.lon !== null && data.lon !== undefined) args.push("-lon", String(data.lon));
    if (data.lat !== null && data.lat !== undefined) args.push("-lat", String(data.lat));
    output = await runNivgen(repoDir, [sub, ...args]);
  } else if (engine === "lr") {
    const args = ["-x", String(coords.x), "-y", String(coords.y), "-z", String(coords.z)];
    if (data.body !== null && data.body !== undefined) args.push("-p", String(data.body));
    if (data.lon !== null && data.lon !== undefined) args.push("-lon", String(data.lon));
    if (data.lat !== null && data.lat !== undefined) args.push("-lat", String(data.lat));
    output = await runNivtest(repoDir, [sub, ...args]);
  } else if (engine === "orig") {
    const extra: string[] = [];
    if (data.body !== null && data.body !== undefined) extra.push(`-p ${data.body}`);
    if (data.lon !== null && data.lon !== undefined) extra.push(`-lon ${data.lon}`);
    if (data.lat !== null && data.lat !== undefined) extra.push(`-lat ${data.lat}`);
    output = await origExplore(repoDir, coords, sub, {
      extra: extra.join(" "),
      build: !!data.build,
      force: !!data.force,
    });
  } else {
    throw new Error(`unknown engine '${engine}'`);
  }
  log.push(output);
  return { action: "explore", engine, sub, star: String(data.star ?? ""), x: coords.x, y: coords.y, z: coords.z, output };
}

const taskdata = await getData();
const repoDir = String(taskdata.repoDir ?? Deno.env.get("NOCTIS_REPO_DIR") ?? DEFAULT_REPO);
const action = String(taskdata.action ?? "verify");
const engine = String(taskdata.engine ?? "rust");

const log: string[] = [];
let result: Record<string, unknown>;
if (action === "stars") {
  result = await actionStars(repoDir, log);
} else if (action === "verify") {
  result = await actionVerify(repoDir, engine, taskdata, log);
} else if (action === "explore") {
  result = await actionExplore(repoDir, engine, taskdata, log);
} else {
  throw new Error(`unknown action '${action}' (known: stars, verify, explore)`);
}

const fullLog = log.join("\n");
const logUrl = await uploadLog(fullLog);
await submitData({ ...result, log_url: logUrl });
