import { UserDB } from "./lib/data_providers/sqlite/userdb.ts";
import { promptSecret } from "https://deno.land/std@0.220.1/cli/prompt_secret.ts";

const userdb = new UserDB();

console.log("Adding user; please specify the following:");
const username = prompt("username");
const password = promptSecret("password");
const permissions = prompt("permissions (separate with commas or use * for all)", "*");

await userdb.addUser(username, password, permissions);
console.log("Done!");
userdb.close();
