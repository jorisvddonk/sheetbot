import jsonwebtoken from "npm:jsonwebtoken@9.0.2";
import { UserDB } from "../data_providers/sqlite/userdb.ts";

const SECRET_KEY = new TextDecoder().decode(Deno.readFileSync("./secret.txt"));

export function createLoginHandler(userdb: UserDB) {
    return async (req: any, res: any) => {
        try {
            const { username, password } = req.body;
            const user = userdb.findUser(username);
            const loginvalid = await userdb.verifyLogin(username, password);
            if (!loginvalid) {
              return res.status(401).json({ error: 'Authentication failed' });
            }
            const token = jsonwebtoken.sign({ userId: username, permissions: String(user.permissions).split(",") }, SECRET_KEY, { expiresIn: '1h' });
            res.json({ token });
          } catch (e) {
            console.log(e);
            return res.status(500).json({ error: 'Authentication failed' });
          }
    };
}

export function createIndexHandler() {
    return (req: any, res: any) => {
        res.sendFile("static/index.html", { root: "." });
    };
}

export function createOpenApiHandler() {
    return (req: any, res: any) => {
        res.contentType("application/yaml");
        res.send(new TextDecoder().decode(Deno.readFileSync("openapi.yaml")));
    };
}