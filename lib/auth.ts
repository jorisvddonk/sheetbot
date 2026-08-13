import jsonwebtoken from "npm:jsonwebtoken@9.0.2";

let secretKey: string | null = null;

function getSecretKey(): string {
    if (secretKey === null) {
        secretKey = new TextDecoder().decode(Deno.readFileSync("./secret.txt"));
    }
    return secretKey;
}

function extractToken(req: any): string | undefined {
    const hdr = req.header('Authorization');
    if (hdr !== undefined) {
        const hdrs = hdr.split(" ");
        if (hdrs[0].toLowerCase() === "bearer" && hdrs[1]) {
            return hdrs[1];
        }
    }
    if (req.cookies?.jwt) {
        return req.cookies.jwt;
    }
    return undefined;
}

/**
 * Verifies the bearer/cookie token if present. Returns the decoded user when
 * valid, null when no token was supplied. Throws the JWT error object when a
 * token was supplied but is invalid.
 */
export async function resolveUser(req: any): Promise<any | null> {
    const token = extractToken(req);
    if (!token) {
        return null;
    }
    return await new Promise((resolve, reject) => {
        jsonwebtoken.verify(token, getSecretKey(), (err: any, user: any) => {
            if (err) {
                reject(err);
            } else {
                resolve(user);
            }
        });
    });
}

export const requiresLogin = (req: any, res: any, next: any) => {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    jsonwebtoken.verify(token, getSecretKey(), (err: any, user: any) => {
        if (err) {
            console.error(err);
            return res.status(403).json({ error: 'Authentication failed' });
        }
        req.user = user;
        next();
    });
};

export const requiresPermission = (permission: string) => {
    return (req: any, res: any, next: any) => {
        if (!Object.hasOwn(req.user, "permissions")) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (req.user.permissions.indexOf("*") === -1 && req.user.permissions.indexOf(permission) === -1) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    }
}