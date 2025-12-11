/**
 * AWS S3-Compatible Credentials Handler
 * 
 * This handler provides temporary AWS credentials that are compatible with AWS CLI tools,
 * allowing them to work with SheetBot's S3-like artefacts API.
 */

import { getDeriveKeySecret, AWS_CREDENTIALS_EXPIRES_IN, AWS_CONFIG } from "../aws-config.ts";
import jsonwebtoken from "npm:jsonwebtoken@9.0.2";

/**
 * Creates a handler that issues temporary AWS-compatible credentials.
 * These credentials can be used with AWS CLI tools to access SheetBot's artefacts API.
 * 
 * @returns {Function} Express route handler function
 */
export function createAwsCredentialsHandler() {
  return async (req: any, res: any) => {
    try {
      // Extract JWT token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }

      const jwtToken = authHeader.split(' ')[1];
      if (!jwtToken) {
        return res.status(401).json({ error: 'Missing JWT token' });
      }

      // Verify the JWT token is valid
      try {
        const user = jsonwebtoken.verify(jwtToken, new TextDecoder().decode(Deno.readFileSync("./secret.txt")));
        
        // Extract user information
        const username = user.userId;
        const permissions = user.permissions || [];

        // Generate AWS access key ID
        const randomBytes = crypto.getRandomValues(new Uint8Array(8));
        const accessKeyId = `${AWS_CONFIG.accessKeyPrefix}${Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

        // Derive AWS secret access key from JWT token (stateless)
        // This ensures the secret can be re-derived for verification without storage
        const hmac = new TextEncoder().encode(getDeriveKeySecret());
        const jwtBytes = new TextEncoder().encode(jwtToken);
        
        const secretAccessKey = crypto.subtle 
          .importKey("raw", hmac, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]) 
          .then((key) => crypto.subtle.sign("HMAC", key, jwtBytes)) 
          .then((signature) => Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join(''));

        // Return AWS-compatible credentials
        res.json({
          accessKeyId,
          secretAccessKey: await secretAccessKey,
          sessionToken: jwtToken,
          expiration: Math.floor(Date.now() / 1000) + AWS_CREDENTIALS_EXPIRES_IN,
          region: AWS_CONFIG.defaultRegion,
           permissions: permissions
        });
        
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError);
        return res.status(401).json({ error: 'Invalid or expired JWT token' });
      }
      
    } catch (err) {
      console.error('AWS credentials generation failed:', err);
      res.status(500).json({ error: 'Failed to generate AWS credentials' });
    }
  };
}

