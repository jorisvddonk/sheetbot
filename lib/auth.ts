import jsonwebtoken from "npm:jsonwebtoken@9.0.2";

const SECRET_KEY = new TextDecoder().decode(Deno.readFileSync("./secret.txt"));

export const requiresLogin = (req: any, res: any, next: any) => {
    const hdr = req.header('Authorization');
    if (hdr === undefined) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const hdrs = hdr.split(" ")
    if (hdrs[0].toLowerCase() !== "bearer") {
        return res.status(401).json({ error: 'Unknown authorization scheme' });
    }
    const token = hdrs[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication failed' });
    }

    jsonwebtoken.verify(token, SECRET_KEY, (err: any, user: any) => {
        if (err) {
            console.error(err);
            return res.status(403).json({ error: 'Authentication failed' });
        }
        req.user = user;
        next();
    });
}

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