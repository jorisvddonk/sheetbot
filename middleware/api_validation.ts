import { validateRequest, validateResponse } from "../api_validator.ts";

export function apiValidationMiddleware(req: any, res: any, next: any) {
  // Skip validation for static files and scripts
  if (req.path.startsWith('/static/') ||
      req.path.startsWith('/scripts/') ||
      req.path.startsWith('/artefacts/')) {
    return next();
  }

  // Validate request
  const requestValidation = validateRequest(req.path, req.method.toLowerCase(), req.body);
  if (!requestValidation.valid) {
    console.warn(`[API Validation] Request validation failed for ${req.method} ${req.path}:`, requestValidation.errors);
    // In development, you might want to return an error, but for production we'll just log
    // return res.status(400).json({ error: "Request validation failed", details: requestValidation.errors });
  }

  // Store original response methods
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;

  // Override status to capture it
  let statusCode = 200;
  res.status = function(code: number) {
    statusCode = code;
    return originalStatus.call(this, code);
  };

  // Override response methods to validate responses
  const validateAndSend = function(body: any, originalMethod: Function) {
    const responseValidation = validateResponse(req.path, req.method.toLowerCase(), statusCode, body);

    if (!responseValidation.valid) {
      console.warn(`[API Validation] Response validation failed for ${req.method} ${req.path} (${statusCode}):`, responseValidation.errors);
      // Again, in development you might want to fail, but we'll just log for now
    }

    return originalMethod.call(res, body);
  };

  res.send = function(body: any) {
    return validateAndSend(body, originalSend);
  };

  res.json = function(body: any) {
    return validateAndSend(body, originalJson);
  };

  next();
}