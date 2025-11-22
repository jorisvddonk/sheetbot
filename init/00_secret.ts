import { existsSync } from "https://deno.land/std@0.220.1/fs/mod.ts";

export default function generateSecret(): void {
    const secretPath = "./secret.txt";

    if (existsSync(secretPath)) {
        console.log("Secret file already exists, skipping generation.");
        return;
    }

    console.log("Generating secret key...");

    // Generate a random ASCII secret (64 characters, printable ASCII)
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const secretArray = new Uint8Array(64);
    crypto.getRandomValues(secretArray);
    let secret = '';
    for (let i = 0; i < 64; i++) {
        secret += charset.charAt(secretArray[i] % charset.length);
    }

    Deno.writeTextFileSync(secretPath, secret);
    console.log("Secret key generated and saved to secret.txt");
}

// Run if this file is executed directly
if (import.meta.main) {
    generateSecret();
}