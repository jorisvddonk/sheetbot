import jsonwebtoken from "npm:jsonwebtoken@9.0.2";
import { UserDB } from "../data_providers/sqlite/userdb.ts";

let secretKey: string | null = null;

function getSecretKey(): string {
    if (secretKey === null) {
        secretKey = new TextDecoder().decode(Deno.readFileSync("./secret.txt"));
    }
    return secretKey;
}

/**
 * Calculates effective permissions by intersecting user permissions and key permissions.
 * Permissions should be max what the user has.
 */
function calculateEffectivePermissions(userPerms: string[], keyPerms: string[]): string[] {
    // If user has all permissions, result is determined by key permissions
    if (userPerms.includes("*")) {
        return keyPerms;
    }

    // If key has all permissions (inherited), result is determined by user permissions
    if (keyPerms.includes("*")) {
        return userPerms;
    }

    // Otherwise, intersection
    return keyPerms.filter(p => userPerms.includes(p));
}

/**
 * Creates a login handler that authenticates users and returns JWT tokens.
 * @param {UserDB} userdb - The user database instance for authentication
 * @returns {Function} Express route handler function
 */
export function createLoginHandler(userdb: UserDB) {
    return async (req: any, res: any) => {
        try {
            const { username, password, apiKey } = req.body;
            let user;
            let permissions: string[] = [];

            if (apiKey) {
                const result = await userdb.verifyApiKey(apiKey);
                if (!result) {
                    return res.status(401).json({ error: 'Invalid API Key' });
                }
                user = result.user;
                const userPerms = String(user.permissions).split(",");
                const keyPerms = result.keyPermissions;
                
                permissions = calculateEffectivePermissions(userPerms, keyPerms);
            } else {
                if (!username || !password) {
                     return res.status(400).json({ error: 'Missing credentials' });
                }
                user = userdb.findUser(username);
                const loginvalid = await userdb.verifyLogin(username, password);
                if (!loginvalid) {
                  return res.status(401).json({ error: 'Authentication failed' });
                }
                permissions = String(user.permissions).split(",");
            }
            
            const token = jsonwebtoken.sign({ userId: user.id, permissions: permissions }, getSecretKey(), { expiresIn: '1h' });
            res.json({ token });
          } catch (e) {
            console.log(e);
            return res.status(500).json({ error: 'Authentication failed' });
          }
    };
}

/**
 * Creates a handler that serves the main index page of the SheetBot web interface.
 * @returns {Function} Express route handler function
 */
export function createIndexHandler() {
    return (req: any, res: any) => {
        res.sendFile("static/index.html", { root: "." });
    };
}

/**
 * Creates a handler that serves the OpenAPI specification file.
 * @returns {Function} Express route handler function
 */
export function createOpenApiHandler() {
    return (req: any, res: any) => {
        res.contentType("application/yaml");
        res.send(new TextDecoder().decode(Deno.readFileSync("openapi.yaml")));
    };
}