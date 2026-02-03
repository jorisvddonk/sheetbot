import { DatabaseSync } from "node:sqlite";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

export const USERDB_DATA_TABLENAME = "users";
export const API_KEYS_TABLENAME = "api_keys";
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
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS "${API_KEYS_TABLENAME}" (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                key_hash TEXT NOT NULL,
                name TEXT,
                created_at INTEGER,
                FOREIGN KEY(user_id) REFERENCES "${USERDB_DATA_TABLENAME}"(id) ON DELETE CASCADE
            )`);
    }


    /**
     * Finds a user by subject.
     * @param subject The user ID
     * @returns The user row
     * @throws Error if not found
     */
    findUser(subject: string) {
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
        const user = this.findUser(username);
        return await bcrypt.compare(hashed_salted_password, String(user.hashed_salted_password));
    }

    /**
     * Adds a new API key for a user.
     * @param userId The user ID
     * @param name The name of the key
     * @returns The generated API key string (id.secret)
     */
    async addApiKey(userId: string, name: string = "default") {
        // Verify user exists
        this.findUser(userId); // throws if not found

        const keyId = crypto.randomUUID();
        const secret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(secret, salt);
        const createdAt = Date.now();

        const stmt = this.db.prepare(`INSERT INTO "${API_KEYS_TABLENAME}" (id, user_id, key_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`);
        stmt.run(keyId, userId, hash, name, createdAt);

        return `${keyId}.${secret}`;
    }

    /**
     * Verifies an API key.
     * @param apiKey The API key string
     * @returns The user object if valid, null otherwise
     */
    async verifyApiKey(apiKey: string) {
        if (!apiKey || !apiKey.includes('.')) return null;
        
        const [keyId, secret] = apiKey.split('.');
        if (!keyId || !secret) return null;

        const stmt = this.db.prepare(`SELECT * FROM "${API_KEYS_TABLENAME}" WHERE id = ?`);
        const row = stmt.get(keyId) as any;

        if (!row) return null;

        const valid = await bcrypt.compare(secret, row.key_hash);
        if (!valid) return null;

        try {
            return this.findUser(row.user_id);
        } catch (e) {
            return null;
        }
    }

    /**
     * Closes the database connection.
     */
    close() {
        this.db.close();
    }

} 