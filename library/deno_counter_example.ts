import { getData, submitData } from "./lib/taskutil.ts";

/*
Suggested name for this task: <name>Deno Counter Example</name>
*/

/*
AddTaskComments: <addTaskComments>
This example demonstrates a simple incrementing counter that stores its value in the task data.
Each time the task runs, it increments the counter by 1 and submits the new value.
The task has an automatic transition that moves COMPLETED tasks back to AWAITING after 5 seconds,
allowing the counter to run repeatedly. The counter persists across task runs within the task's data field.
</addTaskComments>
*/



/*
Suggested capabilitiesSchema for this task: <capabilitiesSchema>
{}
</capabilitiesSchema>
*/

/*
Suggested data for this task: <data>
{
  "counter": 0
}
</data>
*/

/*
Suggested transitions for this task: <transitions>
[
  {
    "statuses": ["COMPLETED"],
    "condition": {},
    "timing": {"every": "5s", "immediate": false},
    "transitionTo": "AWAITING"
  }
]
</transitions>
*/

const taskData = await getData();

// Get current counter value, default to 0 if not set
const currentCounter = taskData.counter || 0;
const newCounter = currentCounter + 1;

// Submit the updated counter value
await submitData({ counter: newCounter, previous: currentCounter });