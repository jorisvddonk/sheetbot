/**
 * Creates a handler that deletes artefact files from the system.
 * Includes path traversal protection by rejecting paths containing '..'.
 * @returns {Function} Express route handler function
 */
export function createDeleteArtefactHandler() {
    return async (req: any, res: any) => {
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
    };
}