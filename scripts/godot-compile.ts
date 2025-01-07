import tmp from "npm:tmp"
import $ from "https://deno.land/x/dax/mod.ts";
import { existsSync } from "https://deno.land/std@0.140.0/node/fs.ts";
import { walk } from "https://deno.land/std@0.220.1/fs/mod.ts";
import { dirname, basename } from "https://deno.land/std@0.220.1/path/mod.ts";
import { tgz } from "https://deno.land/x/compress@v0.4.5/mod.ts";
import { getArtefacts, getData, submitData, uploadArtefactFromFilepath } from "./lib/taskutil.ts";
import { getTask } from "./lib/taskutil.ts";
import { addSheetData } from "./lib/sheetutil.ts";

/*
Suggested name for this task: <name>Godot compile</name>

AddTaskComments: <addTaskComments>
If you want to build a release template, use "additional_build_flags": "target=template_release"
</addTaskComments>

Suggested data for this task: <data>
{
  "branch": "4.3-stable",
  "additional_build_flags": ""
}
</data>

Suggested capabilitiesSchema for this task: <capabilitiesSchema>

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "software": {
      "type": "object",
      "properties": {
        "clang": {
          "type": "object",
          "properties": {
            "major_version": {
              "type": "number",
              "minimum": 6
            }
          },
          "required": [
            "major_version"
          ]
        },
        "deno": {
          "type": "object",
          "properties": {
            "major_version": {
              "type": "number",
              "maximum": 1
            }
          },
          "required": [
            "major_version"
          ]
        }
      },
      "required": [
        "clang", "deno"
      ]
    },
    "memory": {
      "type": "object",
      "properties": {
        "free": {
          "type": "number",
          "minimum": 500
        }
      },
      "required": [
        "free"
      ]
    },
    "loadavg": {
      "type": "object",
      "properties": {
        "5min": {
          "type": "number",
          "exclusiveMaximum": 0.7
        }
      },
      "required": [
        "5min"
      ]
    }
  },
  "required": [
    "memory",
    "loadavg",
    "software"
  ]
}

</capabilitiesSchema>*/

const taskdata = await getData();
let sheet = taskdata.sheet !== undefined ? taskdata.sheet : 'godot';
let branch = taskdata.branch !== undefined ? taskdata.branch : '4.3-stable';
let additional_build_flags = taskdata.additional_build_flags !== undefined ? taskdata.additional_build_flags : '';

async function subtask_statusupdate(subtaskname, completed) {
  const data = {};
  data["subtask/" + subtaskname] = completed ? true : false;
  return submitData(data);
}

await subtask_statusupdate("git clone", false);
await subtask_statusupdate("git fetch", false);
await subtask_statusupdate("git switch", false);
await subtask_statusupdate("scons - build", false);
await subtask_statusupdate("upload artefacts", false);
await submitData({"commit hash": "n/a"});

if (Deno.env.has("GODOT_DIR")) {
  // we expect there to be a checkout already, so just change directory to it!
  $.cd(Deno.env.get("GODOT_DIR"));
} else {
  // create a temporary directory and git clone there (shallowly)!
  let tmpdir = tmp.dirSync().name;
  $.cd(tmpdir);  
  await $`git clone --depth 1 https://github.com/godotengine/godot .`;
  await subtask_statusupdate("git clone", true);
}

await $`git switch --orphan temp_orphan`;
await $`git remote set-branches origin '${branch}'`;
await $`git fetch --depth 1 origin '${branch}:${branch}'`;
await subtask_statusupdate("git fetch", true);
await $`git switch --discard-changes '${branch}'`;
await subtask_statusupdate("git switch", true);

let sheet_key = undefined;
if (taskdata.sheet_key !== undefined) {
    sheet_key = taskdata.sheet_key;
} else {
    const git_commit_hash = await $`git rev-parse HEAD`.text();
    await submitData({"commit hash": git_commit_hash});
    sheet_key = git_commit_hash.trim();
}
console.log("Sheet_key is " + sheet_key + ", sheet is " + sheet);

if (Deno.build.os === "windows") {
  await $`scons platform=windows precision=double ${additional_build_flags}`;
} else {
  await $`scons platform=linuxbsd precision=double use_llvm=yes ${additional_build_flags}`;
}
await subtask_statusupdate("scons - build", true);

// done! Upload the artefact(s)!

let foundArtefacts: Array<string> = [];
for await (const e of walk('./bin', { match: [/godot\.\S+?\.(editor|template_release)(\.double)?.\S+(exe|llvm|x86_64)$/gi] })) {
    if (e.isFile) {
        const foundArtefact = e.path;
        const tmpobj = tmp.fileSync({ mode: 0o644, prefix: basename(foundArtefact), postfix: '.tar.gz', discardDescriptor: true }).name.replaceAll("\\", "/");
        await tgz.compress(foundArtefact, tmpobj, { debug: true });

        const tgz_filename = `${basename(foundArtefact)}.tar.gz`;

        const artefactdata = await uploadArtefactFromFilepath(tmpobj, tgz_filename);
        console.log(artefactdata.directURL);
        await Deno.remove(tmpobj);

        await addSheetData(sheet, {
            key: sheet_key,
            [tgz_filename]: artefactdata.directURL
        });

        console.log("Done! with artefact ", foundArtefact.path);
    }
}
await subtask_statusupdate("upload artefacts", true);
