import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

export const USERDB_DATA_TABLENAME = "users";
export const USERDB_FILEPATH = "./users.db";

export class UserDB {
    db: DB;
    
    constructor() {
        this.db = new DB(USERDB_FILEPATH);
        this.db.execute(`
            CREATE TABLE IF NOT EXISTS "${USERDB_DATA_TABLENAME}" (
                id STRING PRIMARY KEY,
                hashed_salted_password STRING REQUIRED,
                permissions STRING
            )`);
    }


    async findUser(subject: string) {
        const rows = this.db.queryEntries(`SELECT * FROM "${USERDB_DATA_TABLENAME}" WHERE id = :id`, {id: subject});
        if (rows.length > 0) {
            return rows[0];
        } else {
            throw new Error("Not found");
        }
    }

    async addUser(username: string, password: string, permissions: string) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        return this.db.query(`INSERT INTO "${USERDB_DATA_TABLENAME}" (id, hashed_salted_password, permissions) VALUES (:id, :hashed_salted_password, :permissions)`, {
            id: username,
            hashed_salted_password: hash,
            permissions
        });
    }

    async verifyLogin(username: string, hashed_salted_password: string) {
        const user = await this.findUser(username);
        return bcrypt.compare(hashed_salted_password, user.hashed_salted_password);
    }

    close() {
        this.db.close();
    }

} 