import { resolveUser } from "./auth.ts";
import { SheetPermissionsDB } from "./data_providers/sqlite/sheet_permissions.ts";

/**
 * Middleware for read access to a single sheet. Authenticated users may read
 * any sheet; anonymous users may only read sheets with a public read grant.
 */
export const publicSheetOrLogin = async (req: any, res: any, next: any) => {
    try {
        const user = await resolveUser(req);
        if (user) {
            req.user = user;
            return next();
        }
    } catch {
        // token present but invalid/expired: degrade to anonymous rather than
        // failing public access
    }

    const perms = new SheetPermissionsDB();
    try {
        if (perms.isPublic(req.params.id)) {
            return next();
        }
    } finally {
        perms.close();
    }
    return res.status(401).json({ error: 'Unauthorized' });
};

/**
 * Middleware that attaches the authenticated user when a valid token is
 * present, but otherwise lets the request through as anonymous.
 */
export const optionalLogin = async (req: any, res: any, next: any) => {
    try {
        const user = await resolveUser(req);
        if (user) {
            req.user = user;
        }
    } catch {
        // treat an invalid token as anonymous rather than failing the request
    }
    next();
};
