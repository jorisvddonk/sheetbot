import { DatabaseSync } from "node:sqlite";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

export const USERDB_DATA_TABLENAME = "users";
export const USERDB_FILEPATH = "./users.db";

/**
 * Manages user database operations.
 */
export class UserDB {
    db: DatabaseSync;

    /**
     * Initializes the UserDB with a SQLite database.
     */
    constructor() {
        this.db = new DatabaseSync(USERDB_FILEPATH);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS "${USERDB_DATA_TABLENAME}" (
                id TEXT PRIMARY KEY,
                hashed_salted_password TEXT NOT NULL,
                permissions TEXT
            )`);
    }


    /**
     * Finds a user by subject.
     * @param subject The user ID
     * @returns The user row
     * @throws Error if not found
     */
    async findUser(subject: string) {
        const stmt = this.db.prepare(`SELECT * FROM "${USERDB_DATA_TABLENAME}" WHERE id = ?`);
        const row = stmt.get(subject);
        if (row) {
            return row;
        } else {
            throw new Error("Not found");
        }
    }

    /**
     * Adds a new user.
     * @param username The username
     * @param password The password
     * @param permissions The permissions string
     * @returns The result of the insert
     */
    async addUser(username: string, password: string, permissions: string) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const stmt = this.db.prepare(`INSERT INTO "${USERDB_DATA_TABLENAME}" (id, hashed_salted_password, permissions) VALUES (?, ?, ?)`);
        return stmt.run(username, hash, permissions);
    }

    /**
     * Verifies user login.
     * @param username The username
     * @param hashed_salted_password The hashed password
     * @returns True if valid
     */
    async verifyLogin(username: string, hashed_salted_password: string) {
        const user = await this.findUser(username);
        return bcrypt.compare(hashed_salted_password, String(user.hashed_salted_password));
    }

    /**
     * Closes the database connection.
     */
    close() {
        this.db.close();
    }

} 