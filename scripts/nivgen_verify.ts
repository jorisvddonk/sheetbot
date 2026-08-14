import { getData, submitData, uploadArtefactFromFilepath } from "./lib/taskutil.ts";
import { DEFAULT_REPO, runNivgenAction } from "./lib/nivgen_common.ts";

/*
Actions (via task data): stars | verify | explore
  engine  (default "rust")      engine to run
  action  (default "verify")    stars | verify | explore
  repoDir (default DEFAULT_REPO)
  star    star name (verify/explore); auto-selects pending star(s) if empty
  x/y/z   explicit coords (explore)
  body/lon/lat                 explore inputs
  sub     (default "system")   explore subcommand
  force/build                   rebuild the DOSBox harness even if unchanged
  batch   (default 1)           stars to process per verify run

Verify picks stars rolling-first: stale (engine version drift, oldest first),
then failed-at-older-version retries, then never-processed. Existing output is
overwritten in place. Engine versions are tracked in the nivgen_engines sheet.
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

const data = await getData();
const repoDir = String(data.repoDir ?? Deno.env.get("NOCTIS_REPO_DIR") ?? DEFAULT_REPO);
const log: string[] = [];
const result = await runNivgenAction(repoDir, data, log);
const fullLog = log.join("\n");
const logUrl = await uploadLog(fullLog);
await submitData({ ...result, log_url: logUrl });
