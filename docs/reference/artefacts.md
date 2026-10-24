# Artefacts

Artefacts are file outputs associated with tasks, stored in the filesystem for persistence and sharing.

- **Storage**: Files are stored in `./artefacts/tasks/{taskId}/` directories
- **Uploading**: Agents can upload artefacts during execution via POST `/tasks/{id}/artefacts` with multipart/form-data
- **Accessing**: Artefacts are accessible via GET `/tasks/{id}/artefacts/{filename}` which redirects to the direct file URL
- **Listing**: Artefacts are listed in the task's `artefacts` array
- **Deletion**: Individual artefacts can be deleted via DELETE `/tasks/{id}/artefacts/{filename}`
- **Cloning**: When tasks are cloned, artefacts are copied to the new task directory

## S3-Compatible API

SheetBot provides an S3-compatible API for artefact management, enabling integration with S3 clients and tools:

- **Multipart Uploads**: POST `/artefacts/{bucket}/*` for initiating multipart uploads
- **Direct Uploads**: PUT `/artefacts/{bucket}/*` for uploading files or parts
- **Listing**: GET `/artefacts/{bucket}` or GET `/artefacts/{bucket}/*` to list artefacts
- **Deletion**: DELETE `/artefacts/*` to remove artefacts

This allows using standard S3-compatible tools and workflows for artefact handling.

Authentication for the S3-compatible API can be done via standard SheetBot login (with appropriate permissions) or AWS-compatible credentials extracted from requests (`extractAWSCredentialsIfPresent` in `lib/middleware.ts`). Ensure users have the "createArtefacts", "viewArtefacts", or "deleteArtefacts" permissions as needed.

To obtain temporary AWS-compatible credentials for S3 API access, use POST `/artefacts-credentials` after logging in. This returns fake AWS credentials that can be used with S3-compatible tools.

## Public Artefacts Bucket

SheetBot includes routes for a "public" artefacts bucket that allows serving artefacts without authentication. These routes are commented out by default in `main.ts`. To enable public artefact serving, uncomment the following lines in `main.ts`:

```typescript
// GET /artefacts/public - Lists artefacts in the public bucket without login
//app.get('/artefacts/public', createListArtefactsHandler('public'));

// GET /artefacts/public/* - Retrieves public artefact files without login
//app.get('/artefacts/public/*', createListArtefactsHandler('public'));
```

Note that enabling this feature makes artefacts in the named "public" bucket publicly accessible, so use with caution and ensure only appropriate files are placed in the public bucket.