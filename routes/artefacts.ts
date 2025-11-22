import express from "npm:express@4.18.3";
import { requiresLogin, requiresPermission } from "../lib/auth.ts";

const PERMISSION_DELETE_TASKS = "deleteTasks";

export function setupArtefactRoutes(app: express.Application) {
    app.use('/artefacts', express.static('artefacts'));
    app.delete('/artefacts/*', requiresLogin, requiresPermission(PERMISSION_DELETE_TASKS), async function (req, res) {
        if (req.params[0].indexOf("..") === -1) {
            const filepath = `./artefacts/${req.params[0]}`;
            try {
                await Deno.remove(`${filepath}`);
                res.status(204);
                res.send();
            } catch (e) {
                res.status(404);
                res.send();
            }
        } else {
            res.status(404);
            res.send();
        }
    });
}