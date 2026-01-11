/**
 * Creates a handler that lists artefact files in a bucket/prefix, S3-style.
 * @returns {Function} Express route handler function
 */
async function* walkDir(dir: string, base: string = ''): AsyncGenerator<{path: string, stat: Deno.FileInfo}> {
    for await (const entry of Deno.readDir(dir)) {
        const fullPath = `${dir}/${entry.name}`;
        const relPath = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isFile) {
            yield { path: fullPath, stat: await Deno.stat(fullPath) };
        } else if (entry.isDirectory) {
            yield* walkDir(fullPath, relPath);
        }
    }
}

export function createListArtefactsHandler(defaultBucket?: string) {
    return async (req: any, res: any) => {
        console.log("<s3>: ...");
        const bucket = req.params.bucket || defaultBucket;
        let pathPrefix = req.params[0] || '';
        pathPrefix = pathPrefix.replace(/^\/+|\/+$/g, ''); // remove leading/trailing slashes
        const dirpath = `./artefacts/${bucket}`;

        const queryPrefix = req.query.prefix || '';
        const maxKeys = parseInt(req.query['max-keys']) || 1000;
        const delimiter = req.query.delimiter;
        const encodingType = req.query['encoding-type'];

        // Combine path prefix and query prefix
        const fullPrefix = pathPrefix ? (queryPrefix ? `${pathPrefix}/${queryPrefix}` : pathPrefix) : queryPrefix;

        if (dirpath.indexOf("..") !== -1) {
            res.status(400).json({ error: "Invalid path" });
            return;
        }

        // If pathPrefix is specified, check if it's a file or directory
        if (pathPrefix) {
            const filepath = `./artefacts/${bucket}/${pathPrefix}`;
            try {
                const stat = await Deno.stat(filepath);
                console.log('Path:', filepath, 'isFile:', stat.isFile, 'size:', stat.size);
                if (stat.isFile) {
                    // Serve the file
                    console.log('Serving file:', filepath, 'size:', stat.size);
                    const content = await Deno.readFile(filepath);
                    console.log('Read content length:', content.length);
                    res.set('Content-Type', 'application/octet-stream'); // Or detect MIME type
                    res.set('Content-Length', stat.size.toString());
                    res.set('Last-Modified', stat.mtime.toISOString());
                    res.set('ETag', `"${Date.now()}"`);
                    res.end(content);
                    return;
                } else if (stat.isDirectory) {
                    // Continue to listing
                } else {
                    res.status(404).json({ error: "Object not found" });
                    return;
                }
            } catch (e) {
                console.log('Stat error:', e);
                // Path doesn't exist, return 404
                res.status(404).json({ error: "Object not found" });
                return;
            }
        }

        try {
            // Check if bucket directory exists
            try {
                await Deno.stat(dirpath);
            } catch {
                // Bucket doesn't exist, return empty list
                res.set('Content-Type', 'application/xml');
                res.send('<?xml version="1.0" encoding="UTF-8"?>\n<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n</ListBucketResult>');
                return;
            }

            const entries: any[] = [];
            const commonPrefixes = new Set<string>();
            let count = 0;

            for await (const { path: fullPath, stat } of walkDir(dirpath)) {
                // Get relative path from bucket root
                const relPath = fullPath.replace(`${dirpath}/`, '');
                const key = relPath;

                if (key.startsWith(fullPrefix)) {
                    if (delimiter) {
                        // Find the next delimiter after prefix
                        const remaining = key.slice(fullPrefix.length);
                        if (remaining.includes(delimiter)) {
                            const nextDelim = remaining.indexOf(delimiter);
                            const commonPrefix = key.slice(0, fullPrefix.length + nextDelim + delimiter.length);
                            commonPrefixes.add(commonPrefix);
                            continue;
                        }
                    }

                    if (count < maxKeys) {
                        entries.push({
                            key: encodingType === 'url' ? encodeURIComponent(key) : key,
                            size: stat.size,
                            lastModified: stat.mtime,
                        });
                    }
                    count++;
                }
            }

            // Build XML response for S3 ListObjectsV2 compatibility
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
            xml += `  <Name>${bucket}</Name>\n`;
            xml += `  <Prefix>${queryPrefix}</Prefix>\n`;
            xml += `  <KeyCount>${entries.length}</KeyCount>\n`;
            xml += `  <MaxKeys>${maxKeys}</MaxKeys>\n`;
            if (delimiter) {
                xml += `  <Delimiter>${delimiter}</Delimiter>\n`;
            }
            xml += `  <IsTruncated>${count > maxKeys ? 'true' : 'false'}</IsTruncated>\n`;

            for (const entry of entries) {
                xml += '  <Contents>\n';
                xml += `    <Key>${entry.key.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Key>\n`;
                xml += `    <Size>${entry.size}</Size>\n`;
                xml += `    <LastModified>${entry.lastModified.toISOString()}</LastModified>\n`;
                xml += '  </Contents>\n';
            }
            for (const cp of Array.from(commonPrefixes)) {
                const encodedCp = encodingType === 'url' ? encodeURIComponent(cp) : cp;
                xml += '  <CommonPrefixes>\n';
                xml += `    <Prefix>${encodedCp.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Prefix>\n`;
                xml += '  </CommonPrefixes>\n';
            }
            xml += '</ListBucketResult>';

            res.set('Content-Type', 'application/xml');
            res.send(xml);
        } catch (e) {
            res.status(500).json({ error: "Internal error" });
        }
    };
}

// In-memory storage for multipart uploads (in production, use a database)
const multipartUploads = new Map<string, { parts: Map<number, string>, bucket: string, key: string }>();

/**
 * Creates a handler that handles multipart upload operations (S3 compatibility).
 * @returns {Function} Express route handler function
 */
export function createPostArtefactHandler() {
    return async (req: any, res: any) => {
        const bucket = req.params.bucket;
        let key = req.params[0] || '';
        key = key.replace(/^\/+|\/+$/g, ''); // remove leading/trailing slashes

        if ((bucket + '/' + key).indexOf("..") !== -1) {
            res.status(400).json({ error: "Invalid path" });
            return;
        }

        if ('uploads' in req.query) {
            // Initiate multipart upload
            const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            multipartUploads.set(uploadId, { parts: new Map(), bucket, key });

            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<InitiateMultipartUploadResponse xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>${bucket}</Bucket>
  <Key>${key}</Key>
  <UploadId>${uploadId}</UploadId>
</InitiateMultipartUploadResponse>`;

            res.set('Content-Type', 'application/xml');
            res.send(xml);
        } else if (req.query.uploadId) {
            // Complete multipart upload
            const uploadId = req.query.uploadId;
            const upload = multipartUploads.get(uploadId);
            if (!upload) {
                res.status(404).json({ error: "Upload not found" });
                return;
            }

            console.log('Completing multipart', uploadId, Array.from(upload.parts.keys()));

            try {
                const dirpath = `./artefacts/${bucket}`;
                const filepath = `./artefacts/${bucket}/${key}`;

                // Combine all parts by streaming to avoid memory issues
                const parts = Array.from(upload.parts.entries()).sort((a, b) => a[0] - b[0]);
                const finalFile = await Deno.open(filepath, { write: true, create: true });
                try {
                    for (const [, partFile] of parts) {
                        const partData = await Deno.readFile(partFile);
                        let written = 0;
                        while (written < partData.length) {
                            written += await finalFile.write(partData.subarray(written));
                        }
                        await Deno.remove(partFile); // Clean up part file
                    }
                } finally {
                    finalFile.close();
                }

                const finalSize = (await Deno.stat(filepath)).size;
                console.log('Final file size:', finalSize);

                multipartUploads.delete(uploadId);

                const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUploadResponse xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Location>http://localhost:3000/artefacts/${bucket}/${key}</Location>
  <Bucket>${bucket}</Bucket>
  <Key>${key}</Key>
  <ETag>"${Date.now()}"</ETag>
</CompleteMultipartUploadResponse>`;

                res.set('Content-Type', 'application/xml');
                res.send(xml);
            } catch (e) {
                console.error(e);
                res.status(500).json({ error: "Failed to complete upload" });
            }
        } else {
            res.status(400).json({ error: "Invalid multipart operation" });
        }
    };
}

/**
 * Creates a handler that uploads artefact files to S3-like paths.
 * @returns {Function} Express route handler function
 */
export function createPutArtefactHandler() {
    return async (req: any, res: any) => {
        const bucket = req.params.bucket;
        let key = req.params[0] || '';
        key = key.replace(/^\/+|\/+$/g, ''); // remove leading/trailing slashes

        const partNumber = req.query.partNumber;
        const uploadId = req.query.uploadId;

        if ((bucket + '/' + key).indexOf("..") !== -1) {
            res.status(400).json({ error: "Invalid path" });
            return;
        }

        const dirpath = `./artefacts/${bucket}`;
        const filepath = `./artefacts/${bucket}/${key}`;

        try {
            // Ensure directory exists
            await Deno.mkdir(dirpath, { recursive: true });

            if (uploadId && partNumber) {
                // Multipart upload part
                const upload = multipartUploads.get(uploadId);
                if (!upload) {
                    res.status(404).json({ error: "Upload not found" });
                    return;
                }

                console.log('req.body type:', typeof req.body, 'length:', req.body ? req.body.length : 'none');
                const partFile = `${filepath}.part${partNumber}`;
                const data = new Uint8Array(req.body);
                console.log('Uploading part', partNumber, 'size', data.length);
                await Deno.writeFile(partFile, data);

                // Generate ETag from data hash
                const etag = simpleHash(data);
                upload.parts.set(parseInt(partNumber), partFile);

                res.set('ETag', `"${etag}"`);
                res.status(200).send();
            } else {
                // Single part upload
                const data = new Uint8Array(req.body);
                await Deno.writeFile(filepath, data);
                const etag = simpleHash(data);
                res.set('ETag', `"${etag}"`);
                res.status(200).send();
            }
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Failed to upload artefact" });
        }
    };
}

// Simple hash function for ETag
function simpleHash(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash + data[i]) | 0; // djb2-like
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
}

/**
 * Creates a handler that initiates multipart upload (S3 compatibility).
 * @returns {Function} Express route handler function
 */
export function createCompleteMultipartHandler() {
    return async (req: any, res: any) => {
        const bucket = req.params.bucket;
        let key = req.params[0] || '';
        key = key.replace(/^\/+|\/+$/g, ''); // remove leading/trailing slashes

        const uploadId = req.query.uploadId;

        if (!uploadId) {
            res.status(400).json({ error: "Missing uploadId" });
            return;
        }

        const upload = multipartUploads.get(uploadId);
        if (!upload) {
            res.status(404).json({ error: "Upload not found" });
            return;
        }

        try {
            const dirpath = `./artefacts/${bucket}`;
            const filepath = `./artefacts/${bucket}/${key}`;

            // Combine all parts
            const parts = Array.from(upload.parts.entries()).sort((a, b) => a[0] - b[0]);
            const combined = new Uint8Array(parts.reduce((size, [, partFile]) => size + Deno.statSync(partFile).size, 0));
            let offset = 0;
            for (const [, partFile] of parts) {
                const partData = await Deno.readFile(partFile);
                combined.set(partData, offset);
                offset += partData.length;
                await Deno.remove(partFile); // Clean up part file
            }

            await Deno.writeFile(filepath, combined);
            multipartUploads.delete(uploadId);

            // Return S3 XML response
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUploadResponse xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Location>http://localhost:3000/artefacts/${bucket}/${key}</Location>
  <Bucket>${bucket}</Bucket>
  <Key>${key}</Key>
  <ETag>"${Date.now()}"</ETag>
</CompleteMultipartUploadResponse>`;

            res.set('Content-Type', 'application/xml');
            res.send(xml);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Failed to complete upload" });
        }
    };
}

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