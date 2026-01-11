/*
Suggested name for this task: <name>Clock Example</name>

AddTaskComments: <addTaskComments>
This example task generates an HTML page featuring an SVG analog clock that displays the current local time with hour, minute, and second hands, hour marks, and numbers. Below the clock, it includes a textual description with the exact ISO 8601 timestamp and ISO week number when the clock was generated. The resulting clock.html is uploaded to the task's artefacts bucket using fake AWS credentials via the S3-compatible API.
</addTaskComments>
*/

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const now = new Date();
const hours = now.getHours();
const minutes = now.getMinutes();
const seconds = now.getSeconds();

const secondAngle = seconds * 6;
const minuteAngle = minutes * 6 + seconds * 0.1;
const hourAngle = (hours % 12) * 30 + minutes * 0.5;

const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hour = String(now.getHours()).padStart(2, '0');
const minute = String(now.getMinutes()).padStart(2, '0');
const second = String(now.getSeconds()).padStart(2, '0');
const timeString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
const weekNumber = getWeekNumber(now);

const htmlContent = `<html>
<head>
    <title>SVG Clock</title>
    <style>
        body { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; }
        svg { border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        p { margin-top: 20px; text-align: center; font-family: Arial, sans-serif; }
    </style>
</head>
<body>
    <svg width="200" height="200" viewBox="0 0 200 200">
        <!-- Clock face -->
        <circle cx="100" cy="100" r="90" fill="white" stroke="black" stroke-width="2"/>
        
        <!-- Hour marks -->
        ${Array.from({length: 12}, (_, i) => {
            const angle = (i * 30) - 90;
            const x1 = 100 + 70 * Math.cos(angle * Math.PI / 180);
            const y1 = 100 + 70 * Math.sin(angle * Math.PI / 180);
            const x2 = 100 + 80 * Math.cos(angle * Math.PI / 180);
            const y2 = 100 + 80 * Math.sin(angle * Math.PI / 180);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="2"/>`;
        }).join('')}
        
        <!-- Numbers -->
        ${Array.from({length: 12}, (_, i) => {
            const num = i === 0 ? 12 : i;
            const angle = (i * 30) - 90;
            const x = 100 + 60 * Math.cos(angle * Math.PI / 180);
            const y = 100 + 60 * Math.sin(angle * Math.PI / 180) + 5;
            return `<text x="${x}" y="${y}" text-anchor="middle" font-size="16" fill="black">${num}</text>`;
        }).join('')}
        
        <!-- Hour hand -->
        <line x1="100" y1="100" x2="100" y2="50" stroke="black" stroke-width="4" transform="rotate(${hourAngle} 100 100)"/>
        
        <!-- Minute hand -->
        <line x1="100" y1="100" x2="100" y2="30" stroke="black" stroke-width="3" transform="rotate(${minuteAngle} 100 100)"/>
        
        <!-- Second hand -->
        <line x1="100" y1="100" x2="100" y2="20" stroke="red" stroke-width="2" transform="rotate(${secondAngle} 100 100)"/>
        
        <!-- Center dot -->
        <circle cx="100" cy="100" r="3" fill="black"/>
    </svg>
    <p>The time was ${timeString} when this clock was generated. Week number: ${weekNumber}</p>
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