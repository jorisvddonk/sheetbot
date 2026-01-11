import $ from "https://deno.land/x/dax/mod.ts";
import { submitData, getData } from "./lib/taskutil.ts";
import { addSheetData } from "./lib/sheetutil.ts";

/*
AddTaskComments: <addTaskComments>
This example demonstrates basic git operations by collecting the git version and submitting it along with a timestamp to the task data.
</addTaskComments>
*/

/*
Suggested capabilitiesSchema for this task: <capabilitiesSchema>

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "packages": {
      "type": "array",
      "allOf": [
        {
          "contains": {
            "const": "git"
          }
        }
      ]
    }
  },
  "required": [
    "packages"
  ]
}

</capabilitiesSchema>*/

async function setData(name, value) {
  const data = {};
  data[name] = value;
  return await submitData(data);
}

const taskData = await getData();
await setData("hello", new Date().toISOString());
const git_version = await $`git --version`.text();
await setData("git version", git_version);
