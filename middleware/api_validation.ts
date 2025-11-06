import Ajv from "npm:ajv";
import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function createApiValidationMiddleware(specPath: string) {
  const openapiSpec = parse(Deno.readTextFileSync(specPath)) as any;
  const ajv = new (Ajv as any)({ allErrors: true, strict: false });
  ajv.addFormat('uuid', {
    type: 'string',
    validate: (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  });

  // Add all schemas to AJV for $ref resolution
  for (const [name, schema] of Object.entries(openapiSpec.components.schemas)) {
    ajv.addSchema(schema, `#/components/schemas/${name}`);
  }



  function findPathSpec(path: string, method: string) {
    for (const [specPath, methods] of Object.entries(openapiSpec.paths)) {
      const regex = new RegExp("^" + specPath.replace(/\{[^}]+\}/g, "[^/]+") + "$");
      if (regex.test(path) && methods[method]) {
        return methods[method];
      }
    }
    return null;
  }

  function validateRequest(path: string, method: string, body: any): ValidationResult {
    const spec = findPathSpec(path, method);
    if (!spec || !spec.requestBody) {
      return { valid: true, errors: [] }; // No validation needed
    }

  const schema = spec.requestBody.content?.['application/json']?.schema;
  if (!schema) {
    return { valid: true, errors: [] };
  }

  const validate = ajv.compile(schema);
    const valid = validate(body);
    return {
      valid: !!valid,
      errors: validate.errors ? validate.errors.map(e => e.message || '') : []
    };
  }

  function validateResponse(path: string, method: string, statusCode: number, body: any): ValidationResult {
    const spec = findPathSpec(path, method);
    if (!spec || !spec.responses || !spec.responses[statusCode]) {
      return { valid: true, errors: [] }; // No validation needed
    }

  const responseSpec = spec.responses[statusCode];
  const schema = responseSpec.content?.['application/json']?.schema;
  if (!schema) {
    return { valid: true, errors: [] };
  }

  const validate = ajv.compile(schema);
    const valid = validate(body);
    return {
      valid: !!valid,
      errors: validate.errors ? validate.errors.map(e => e.message || '') : []
    };
  }

  const middleware = function apiValidationMiddleware(req: any, res: any, next: any) {
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
    if (typeof body === 'string') {
      return originalSend.call(res, body);
    }
    return validateAndSend(body, originalSend);
  };

  res.json = function(body: any) {
    return validateAndSend(body, originalJson);
  };

   next();
  };
  return middleware;
}