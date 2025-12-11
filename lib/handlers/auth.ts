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
 * Creates a login handler that authenticates users and returns JWT tokens.
 * @param {UserDB} userdb - The user database instance for authentication
 * @returns {Function} Express route handler function
 */
export function createLoginHandler(userdb: UserDB) {
    return async (req: any, res: any) => {
        try {
            const { username, password } = req.body;
            const user = userdb.findUser(username);
            const loginvalid = await userdb.verifyLogin(username, password);
            if (!loginvalid) {
              return res.status(401).json({ error: 'Authentication failed' });
            }
            const token = jsonwebtoken.sign({ userId: username, permissions: String(user.permissions).split(",") }, getSecretKey(), { expiresIn: '1h' });
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