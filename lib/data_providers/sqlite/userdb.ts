import { DatabaseSync } from "node:sqlite";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

export const USERDB_DATA_TABLENAME = "users";
export const USERDB_FILEPATH = "./users.db";

export class UserDB {
    db: DatabaseSync;
    
    constructor() {
        this.db = new DatabaseSync(USERDB_FILEPATH);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS "${USERDB_DATA_TABLENAME}" (
                id TEXT PRIMARY KEY,
                hashed_salted_password TEXT NOT NULL,
                permissions TEXT
            )`);
    }


    async findUser(subject: string) {
        const stmt = this.db.prepare(`SELECT * FROM "${USERDB_DATA_TABLENAME}" WHERE id = ?`);
        const row = stmt.get(subject);
        if (row) {
            return row;
        } else {
            throw new Error("Not found");
        }
    }

    async addUser(username: string, password: string, permissions: string) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const stmt = this.db.prepare(`INSERT INTO "${USERDB_DATA_TABLENAME}" (id, hashed_salted_password, permissions) VALUES (?, ?, ?)`);
        return stmt.run(username, hash, permissions);
    }

    async verifyLogin(username: string, hashed_salted_password: string) {
        const user = await this.findUser(username);
        return bcrypt.compare(hashed_salted_password, user.hashed_salted_password);
    }

    close() {
        this.db.close();
    }

} 