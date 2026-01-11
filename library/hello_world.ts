/*
Suggested name for this task: <name>Hello World</name>

AddTaskComments: <addTaskComments>
This is a simple example task that stores a "hello world" message with the current timestamp in the task data.
</addTaskComments>
*/

import { submitData } from "./lib/taskutil.ts";

const message = `hello, world! the time is ${new Date().toISOString()}`;

const data = {
  message: message
};

await submitData(data);