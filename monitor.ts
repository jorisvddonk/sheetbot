#!/usr/bin/env deno run --allow-all

/**
 * Sheetbot Event Monitor
 * A Deno script that connects to the Sheetbot SSE events API and displays real-time events
 * 
 * Usage:
 * deno run --allow-all monitor.ts [--api-key <API_KEY>] [--username <USERNAME>] [--password <PASSWORD>] [--url <API_URL>]
 * 
 * Environment variables:
 * - SHEETBOT_AUTH_APIKEY: API key for authentication
 * - SHEETBOT_AUTH_USER: Username for login
 * - SHEETBOT_AUTH_PASS: Password for login
 * - SHEETBOT_BASEURL: Base URL of Sheetbot instance (default: http://localhost:3000)
 * 
 * If no credentials are provided, it will prompt for input
 */

import { parse } from "https://deno.land/std@0.207.0/flags/mod.ts";

// Colors for terminal output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  reset: "\x1b[0m"
};

// Parse command-line arguments
const flags = parse(Deno.args, {
  string: ["api-key", "username", "password", "url"],
  boolean: ["help", "verbose", "debug", "no-retry"],
  alias: { 
    k: "api-key", 
    u: "url", 
    U: "username", 
    P: "password",
    h: "help",
    v: "verbose",
    d: "debug",
    "no-retry": "no-retry"
  },
  default: {
    url: Deno.env.get("SHEETBOT_BASEURL") || "http://localhost:3000",
    "no-retry": false
  }
});

// Show help if requested
if (flags.help) {
  console.log(`
${colors.blue}Sheetbot Event Monitor${colors.reset}

A Deno script that connects to the Sheetbot SSE events API and displays real-time events

${colors.bold}Usage:${colors.reset}
  deno run --allow-all monitor.ts [options]

${colors.bold}Options:${colors.reset}
  --api-key, -k <key>        API key for authentication
  --username, -U <name>      Username for login
  --password, -P <pass>      Password for login
  --url, -u <url>            Base URL of Sheetbot instance (default: http://localhost:3000)
  --no-retry                 Disable automatic reconnection on error
  --verbose, -v              Show detailed event data
  --debug, -d                Enable debug logging
  --help, -h                 Show this help message

${colors.bold}Environment Variables:${colors.reset}
  SHEETBOT_AUTH_APIKEY       API key for authentication
  SHEETBOT_AUTH_USER         Username for login
  SHEETBOT_AUTH_PASS         Password for login
  SHEETBOT_BASEURL           Base URL of Sheetbot instance (default: http://localhost:3000)

${colors.bold}Example:${colors.reset}
  deno run --allow-all monitor.ts --api-key YOUR_API_KEY --url http://localhost:3000

  # Using environment variables
  export SHEETBOT_AUTH_APIKEY=YOUR_API_KEY
  deno run --allow-all monitor.ts
`);
  Deno.exit(0);
}

// Ensure URL ends with /events
let eventsUrl = flags.url;
if (!eventsUrl.endsWith("/events")) {
  eventsUrl = eventsUrl.endsWith("/") 
    ? `${eventsUrl}events` 
    : `${eventsUrl}/events`;
}

// Event type to color mapping
const eventColors: Record<string, string> = {
  "task:created": colors.green,
  "task:completed": colors.blue,
  "task:failed": colors.red,
  "task:added": colors.cyan,
  "task:changed": colors.yellow,
  "task:status_changed": colors.magenta,
  "task:deleted": colors.red,
  "agent:connected": colors.green
};

// Get authentication credentials
async function getAuthCredentials(): Promise<{ apiKey?: string; username?: string; password?: string }> {
  // Try command-line arguments
  if (flags["api-key"]) {
    return { apiKey: flags["api-key"] };
  }
  if (flags.username && flags.password) {
    return { username: flags.username, password: flags.password };
  }

  // Try environment variables
  const apiKey = Deno.env.get("SHEETBOT_AUTH_APIKEY");
  if (apiKey) {
    return { apiKey };
  }
  const username = Deno.env.get("SHEETBOT_AUTH_USER");
  const password = Deno.env.get("SHEETBOT_AUTH_PASS");
  if (username && password) {
    return { username, password };
  }

  // Try .env file
  try {
    const envContent = await Deno.readTextFile(".env");
    const apiKeyMatch = envContent.match(/SHEETBOT_AUTH_APIKEY=(.*)/);
    if (apiKeyMatch) {
      const key = apiKeyMatch[1].trim();
      return { apiKey: key.startsWith('"') && key.endsWith('"') ? key.slice(1, -1) : key };
    }
    const userMatch = envContent.match(/SHEETBOT_AUTH_USER=(.*)/);
    const passMatch = envContent.match(/SHEETBOT_AUTH_PASS=(.*)/);
    if (userMatch && passMatch) {
      let user = userMatch[1].trim();
      let pass = passMatch[1].trim();
      if (user.startsWith('"') && user.endsWith('"')) {
        user = user.slice(1, -1);
      }
      if (pass.startsWith('"') && pass.endsWith('"')) {
        pass = pass.slice(1, -1);
      }
      return { username: user, password: pass };
    }
  } catch (e) {
    // Ignore if .env file doesn't exist
  }

  // Prompt user for credentials
  console.log(`${colors.yellow}No authentication credentials found.${colors.reset}`);
  const useApiKey = prompt("Use API key (y/n)?", "y")?.toLowerCase().startsWith("y");
  
  if (useApiKey) {
    const apiKey = prompt("API Key:");
    if (!apiKey?.trim()) {
      console.log(`${colors.red}Error: No API key provided${colors.reset}`);
      Deno.exit(1);
    }
    return { apiKey: apiKey.trim() };
  } else {
    const username = prompt("Username:");
    const password = prompt("Password:");
    if (!username?.trim() || !password?.trim()) {
      console.log(`${colors.red}Error: Username and password are required${colors.reset}`);
      Deno.exit(1);
    }
    return { username: username.trim(), password: password.trim() };
  }
}

// Authenticate and get JWT token
async function authenticate(baseUrl: string, credentials: { apiKey?: string; username?: string; password?: string }): Promise<string> {
  const loginUrl = baseUrl.endsWith("/") 
    ? `${baseUrl}login` 
    : `${baseUrl}/login`;
  
  let loginBody: any;
  let authMethod: string;
  
  if (credentials.apiKey) {
    loginBody = { apiKey: credentials.apiKey };
    authMethod = "API key";
  } else if (credentials.username && credentials.password) {
    loginBody = {
      username: credentials.username,
      password: credentials.password
    };
    authMethod = `User ${credentials.username}`;
  } else {
    throw new Error("No valid authentication credentials");
  }
  
  console.log(`${colors.blue}Authenticating with ${authMethod}...${colors.reset}`);
  
  const loginResponse = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loginBody)
  });
  
  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    throw new Error(`Authentication failed: ${loginResponse.status} ${loginResponse.statusText}${errorText ? ` - ${errorText}` : ""}`);
  }
  
  const loginData = await loginResponse.json();
  if (!loginData.token) {
    throw new Error("Authentication failed: No token received");
  }
  
  return loginData.token;
}

// Format time for display
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// Display event in terminal
function displayEvent(eventName: string, eventData: any) {
  const color = eventColors[eventName] || colors.white;
  const time = formatTime(eventData.data.timestamp);
  
  // Basic event information
  let output = `${colors.cyan}[${time}]${colors.reset} ${color}${eventName}${colors.reset}`;
  
  // Task events
  if (eventData.type === "task") {
    output += ` ${colors.yellow}#${eventData.data.taskId}${colors.reset}`;
    
    if (eventData.data.task) {
      if (eventData.data.task.name) {
        output += ` ${colors.white}${eventData.data.task.name}${colors.reset}`;
      }
      if (eventData.data.oldStatus !== undefined && eventData.data.newStatus !== undefined) {
        output += ` ${colors.red}${eventData.data.oldStatus}${colors.reset} → ${colors.green}${eventData.data.newStatus}${colors.reset}`;
      }
    }
  } 
  // Agent events
  else if (eventData.type === "agent") {
    output += ` ${colors.yellow}${eventData.data.id}${colors.reset}`;
    output += ` ${colors.white}(${eventData.data.ip})${colors.reset}`;
    if (eventData.data.type) {
      output += ` ${colors.blue}${eventData.data.type}${colors.reset}`;
    }
  }
  
  console.log(output);
  
  // Detailed event data (for debugging)
  if (flags.verbose || flags.debug) {
    console.log(`${colors.gray}${JSON.stringify(eventData, null, 2)}${colors.reset}`);
    console.log();
  }
}

// Main function
async function main() {
  try {
    const credentials = await getAuthCredentials();
    const baseUrl = flags.url;
    
    console.log(`${colors.cyan}Connecting to Sheetbot events API at: ${eventsUrl}${colors.reset}`);
    console.log(`${colors.gray}Press Ctrl+C to stop monitoring${colors.reset}`);
    console.log("----------------------------------------");
    
    // Authenticate
    const token = await authenticate(baseUrl, credentials);
    console.log(`${colors.green}✓ Authentication successful${colors.reset}`);
    console.log();
    
    const response = await fetch(eventsUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache"
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`${colors.red}Error ${response.status}: ${response.statusText}${colors.reset}`);
      if (errorText) {
        console.log(`${colors.gray}${errorText}${colors.reset}`);
      }
      Deno.exit(1);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      console.log(`${colors.red}Error: No response body${colors.reset}`);
      Deno.exit(1);
    }
    
    const decoder = new TextDecoder();
    let buffer = "";
    
    // Read events from stream
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log(`${colors.yellow}Connection closed by server${colors.reset}`);
        break;
      }
      
      buffer += decoder.decode(value);
      
      // Split buffer into individual events
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      
      for (const rawEvent of events) {
        if (!rawEvent.trim()) continue;
        
        try {
          // Parse SSE format
          const lines = rawEvent.split("\n").filter(line => line.trim());
          let eventName = "message";
          let eventData = "";
          
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice("event:".length).trim();
            } else if (line.startsWith("data:")) {
              eventData = line.slice("data:".length).trim();
            }
          }
          
          if (eventData) {
            const parsedData = JSON.parse(eventData);
            displayEvent(eventName, parsedData);
          }
        } catch (parseError) {
          console.log(`${colors.red}Error parsing event: ${parseError}${colors.reset}`);
          console.log(`${colors.gray}${rawEvent}${colors.reset}`);
        }
      }
    }
    
  } catch (error) {
    console.log(`${colors.red}${error.message}${colors.reset}`);
    
    // Retry logic (simple exponential backoff)
    if (!flags["no-retry"]) {
      console.log(`${colors.yellow}Retrying in 5 seconds...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      main(); // Recursive retry
    } else {
      Deno.exit(1);
    }
  }
}

// Handle Ctrl+C
Deno.addSignalListener("SIGINT", () => {
  console.log(`\n${colors.cyan}Monitoring stopped. Goodbye!${colors.reset}`);
  Deno.exit(0);
});

// Start monitoring
main();