import express from "npm:express@4.18.3";
import jsonwebtoken from "npm:jsonwebtoken@9.0.2";
import { UserDB } from "../lib/data_providers/sqlite/userdb.ts";

const SECRET_KEY = new TextDecoder().decode(Deno.readFileSync("./secret.txt"));
const userdb = new UserDB();

export function setupAuthRoutes(app: express.Application) {
    app.post("/login", async (req, res) => {
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
    });

    app.get("/", function (req, res) {
      res.sendFile("static/index.html", { root: "." });
    });

    app.get("/openapi.yaml", function (req, res) {
      res.contentType("application/yaml");
      res.send(new TextDecoder().decode(Deno.readFileSync("openapi.yaml")));
    });
}