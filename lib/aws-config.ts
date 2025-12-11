/**
 * AWS S3-Compatible Credentials Configuration
 * 
 * This module provides configuration for AWS S3-compatible authentication
 * that allows AWS CLI tools to work with SheetBot's artefacts API.
 */

// Master HMAC key for deriving AWS secret access keys
// Lazily loaded from secret.txt for consistency with JWT secrets
let deriveKeySecret: string | null = null;

export function getDeriveKeySecret(): string {
    if (deriveKeySecret === null) {
        deriveKeySecret = new TextDecoder().decode(Deno.readFileSync("./secret.txt"));
    }
    return deriveKeySecret;
}

// AWS credentials expiration (in seconds)
export const AWS_CREDENTIALS_EXPIRES_IN = 3600; // 1 hour

// AWS credentials configuration
export const AWS_CONFIG = {
  // Maximum number of active credentials per user
  maxCredentialsPerUser: 10,
  
  // Credential prefix for generated access keys
  accessKeyPrefix: "SBTEMP",
  
  // Whether to enforce full SigV4 signature verification
  // (currently disabled for simplicity, can be enabled later)
  enforceSigV4Verification: false,
  
  // Supported AWS regions (for compatibility)
  supportedRegions: ["us-east-1", "eu-west-1", "ap-southeast-1"],
  
  // Default region
  defaultRegion: "us-east-1"
};

// AWS error messages
export const AWS_ERROR_MESSAGES = {
  MISSING_CREDENTIALS: "Missing AWS credentials",
  INVALID_SIGNATURE: "Invalid AWS signature",
  EXPIRED_TOKEN: "AWS session token expired",
  INVALID_REGION: "Invalid AWS region",
  ACCESS_DENIED: "Access denied to AWS resource"
};