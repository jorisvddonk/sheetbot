#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * SheetBot TUI - Terminal User Interface for viewing tasks
 * 
 * Usage:
 *   export SHEETBOT_AUTH_USER=username
 *   export SHEETBOT_AUTH_PASS=password
 *   # Or use API key:
 *   # export SHEETBOT_AUTH_APIKEY=your.api.key
 *   export SHEETBOT_BASEURL=http://localhost:3000
 *   deno run --allow-net --allow-env ${SHEETBOT_BASEURL}/tui.ts
 */

import { Table } from "https://deno.land/x/cliffy@v1.0.0-rc.4/table/mod.ts";
import { colors } from "https://deno.land/x/cliffy@v1.0.0-rc.4/ansi/colors.ts";
import { Input } from "https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/mod.ts";

// Task status enum
const TaskStatus = {
  0: "AWAITING",
  1: "RUNNING",
  2: "COMPLETED",
  3: "FAILED",
  4: "PAUSED"
};

// Status colors
function colorStatus(status: number): string {
  const statusText = TaskStatus[status as keyof typeof TaskStatus] || "UNKNOWN";
  switch (status) {
    case 0: return colors.cyan(statusText);      // AWAITING - cyan
    case 1: return colors.yellow(statusText);    // RUNNING - yellow
    case 2: return colors.green(statusText);     // COMPLETED - green
    case 3: return colors.red(statusText);       // FAILED - red
    case 4: return colors.gray(statusText);      // PAUSED - gray
    default: return statusText;
  }
}

// Truncate text with ellipsis
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

// Get base URL
const baseUrl = Deno.env.get("SHEETBOT_BASEURL") || await Input.prompt({
  message: "SheetBot Base URL:",
  default: "http://localhost:3000"
});

// Authentication
let token: string;

try {
  let loginBody: any;
  
  if (Deno.env.get("SHEETBOT_AUTH_APIKEY")) {
    console.log(colors.blue("Authenticating with API key..."));
    loginBody = { apiKey: Deno.env.get("SHEETBOT_AUTH_APIKEY") };
  } else if (Deno.env.get("SHEETBOT_AUTH_USER") && Deno.env.get("SHEETBOT_AUTH_PASS")) {
    console.log(colors.blue(`Authenticating as ${Deno.env.get("SHEETBOT_AUTH_USER")}...`));
    loginBody = {
      username: Deno.env.get("SHEETBOT_AUTH_USER"),
      password: Deno.env.get("SHEETBOT_AUTH_PASS")
    };
  } else {
    console.log(colors.red("Error: No authentication credentials provided"));
    console.log("Set SHEETBOT_AUTH_USER and SHEETBOT_AUTH_PASS, or SHEETBOT_AUTH_APIKEY");
    Deno.exit(1);
  }

  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loginBody)
  });

  if (!loginResponse.ok) {
    console.log(colors.red(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`));
    Deno.exit(1);
  }

  const loginData = await loginResponse.json();
  token = loginData.token;
  console.log(colors.green("✓ Authentication successful\n"));
} catch (error) {
  console.log(colors.red(`Connection error: ${error.message}`));
  Deno.exit(1);
}

// Fetch tasks
console.log(colors.blue("Fetching tasks...\n"));

try {
  const tasksResponse = await fetch(`${baseUrl}/tasks`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!tasksResponse.ok) {
    console.log(colors.red(`Failed to fetch tasks: ${tasksResponse.status} ${tasksResponse.statusText}`));
    Deno.exit(1);
  }

  const tasks = await tasksResponse.json();

  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log(colors.yellow("No tasks found."));
    Deno.exit(0);
  }

  // Create table
  const table = new Table()
    .header([
      colors.bold("ID"),
      colors.bold("Name"),
      colors.bold("Type"),
      colors.bold("Status"),
      colors.bold("Dependencies")
    ])
    .border(true);

  // Add rows
  for (const task of tasks) {
    const id = truncate(task.id, 12);
    const name = task.name ? truncate(task.name, 30) : colors.gray("(unnamed)");
    const type = task.type || "deno";
    const status = colorStatus(task.status);
    const deps = task.dependsOn && task.dependsOn.length > 0 
      ? task.dependsOn.length.toString() 
      : colors.gray("-");

    table.push([id, name, type, status, deps]);
  }

  // Print table
  table.render();

  // Summary
  const summary = {
    total: tasks.length,
    awaiting: tasks.filter((t: any) => t.status === 0).length,
    running: tasks.filter((t: any) => t.status === 1).length,
    completed: tasks.filter((t: any) => t.status === 2).length,
    failed: tasks.filter((t: any) => t.status === 3).length,
    paused: tasks.filter((t: any) => t.status === 4).length
  };

  console.log("\n" + colors.bold("Summary:"));
  console.log(`  Total: ${summary.total}`);
  if (summary.awaiting > 0) console.log(`  ${colors.cyan("Awaiting")}: ${summary.awaiting}`);
  if (summary.running > 0) console.log(`  ${colors.yellow("Running")}: ${summary.running}`);
  if (summary.completed > 0) console.log(`  ${colors.green("Completed")}: ${summary.completed}`);
  if (summary.failed > 0) console.log(`  ${colors.red("Failed")}: ${summary.failed}`);
  if (summary.paused > 0) console.log(`  ${colors.gray("Paused")}: ${summary.paused}`);

} catch (error) {
  console.log(colors.red(`Error: ${error.message}`));
  Deno.exit(1);
}
