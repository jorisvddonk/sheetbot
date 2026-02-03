import { UserDB } from "./lib/data_providers/sqlite/userdb.ts";

const userdb = new UserDB();

console.log("Adding API key for user");
const username = prompt("username");
if (!username) {
    console.error("Username is required");
    Deno.exit(1);
}

try {
    userdb.findUser(username);
} catch (e) {
    console.error(`User '${username}' not found.`);
    Deno.exit(1);
}

const keyName = prompt("key name (optional)", "default") || "default";
const permissions = prompt("permissions (separate with commas or use * for all)", "*") || "*";

console.log("Generating key...");
const apiKey = await userdb.addApiKey(username, keyName, permissions);

console.log("\nAPI Key generated successfully:");
console.log("----------------------------------------");
console.log(apiKey);
console.log("----------------------------------------");
console.log("Keep this key safe! You won't be able to see it again.");

userdb.close();
