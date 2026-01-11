/*
Suggested name for this task: <name>Clock Example</name>

AddTaskComments: <addTaskComments>
This is a simple example task that fetches fake AWS credentials and uploads a clock.html file containing the current time to the task's artefacts bucket using the S3-compatible API with AWS creds in headers.
</addTaskComments>
*/

const currentTime = new Date().toISOString();
const htmlContent = `<html>
<head>
    <title>Current Time</title>
</head>
<body>
    <h1>The current time is: ${currentTime}</h1>
</body>
</html>`;

// Get the task ID from the task base URL
const taskId = Deno.env.get("SHEETBOT_TASK_BASEURL").split('/').pop();

// Fetch fake AWS credentials for S3-compatible API
const credsRes = await fetch(`${Deno.env.get("SHEETBOT_BASEURL")}/artefacts-credentials`, {
    method: "POST",
    headers: {
        "Authorization": Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
    }
});
if (!credsRes.ok) {
    throw new Error(`Failed to fetch credentials: ${credsRes.statusText}`);
}
const creds = await credsRes.json();
console.log("Fetched AWS credentials:", creds);

// Upload to the task's artefacts bucket using the S3-compatible API with creds in headers
const response = await fetch(`${Deno.env.get("SHEETBOT_BASEURL")}/artefacts/${taskId}/clock.html`, {
    method: "PUT",
    headers: {
        "Content-Type": "text/html",
        "Authorization": Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER"), // JWT auth
        "X-Amz-Security-Token": creds.sessionToken,
        "X-Amz-Access-Key-Id": creds.accessKeyId
    },
    body: htmlContent
});

if (!response.ok) {
    throw new Error(`Failed to upload artefact: ${response.statusText}`);
}

const directURL = `${Deno.env.get("SHEETBOT_BASEURL")}/artefacts/${taskId}/clock.html`;
console.log("Uploaded clock.html to task artefacts bucket:", directURL);

// Submit the artefact URL to task data
await fetch(`${Deno.env.get("SHEETBOT_BASEURL")}/tasks/${taskId}/data`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
    },
    body: JSON.stringify({ data: { artefactURL: directURL } })
});