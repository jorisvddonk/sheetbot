/**
 * JSON Schema explanation utilities
 * Provides human-readable explanations of JSON Schema constructs
 */

export interface SchemaExplanationOptions {
  indent?: string;
}

export class SchemaExplainer {
  private indent: string;

  constructor(options: SchemaExplanationOptions = {}) {
    this.indent = options.indent || '';
  }

  /**
   * Generate a human-readable explanation of a JSON Schema
   */
  explainSchema(schema: any, indent = ''): string {
    if (!schema || typeof schema !== 'object') {
      return 'Invalid schema';
    }

    let explanation = '';

    // Handle special cases first
    if (schema.not) {
      explanation += `${indent}This must NOT match: ${this.explainSchema(schema.not, indent + '  ').trim()}\n`;
      return explanation;
    }

    if (schema.const !== undefined) {
      explanation += `${indent}This must be exactly: ${JSON.stringify(schema.const)}\n`;
      return explanation;
    }

    if (schema.enum && !schema.type) {
      explanation += `${indent}This must be one of: ${schema.enum.map((v: any) => JSON.stringify(v)).join(', ')}\n`;
      return explanation;
    }

    // Handle combinators first (before type-specific logic)
    if (schema.allOf) {
      explanation += this.explainAllOfSchema(schema, indent);
      return explanation;
    }

    if (schema.oneOf) {
      explanation += this.explainOneOfSchema(schema, indent);
      return explanation;
    }

    if (schema.anyOf) {
      explanation += this.explainAnyOfSchema(schema, indent);
      return explanation;
    }

    // Main type
    if (schema.type) {
      explanation += `${indent}This is a ${schema.type}`;
      if (schema.title) {
        explanation += ` (${schema.title})`;
      }
      explanation += '.\n';
    }

    // Description
    if (schema.description) {
      explanation += `${indent}${schema.description}\n`;
    }

    // Default value
    if (schema.default !== undefined) {
      explanation += `${indent}Default value: ${JSON.stringify(schema.default)}\n`;
    }

    // Examples
    if (schema.examples && Array.isArray(schema.examples)) {
      explanation += `${indent}Examples: ${schema.examples.map((ex: any) => JSON.stringify(ex)).join(', ')}\n`;
    }

    // Format
    if (schema.format) {
      explanation += `${indent}Format: ${schema.format}\n`;
    }

    // Access control
    if (schema.readOnly) {
      explanation += `${indent}Read-only.\n`;
    }

    if (schema.writeOnly) {
      explanation += `${indent}Write-only.\n`;
    }

    if (schema.deprecated) {
      explanation += `${indent}Deprecated.\n`;
    }

    // Handle constraint keywords that can apply to any type
    explanation += this.explainConstraintKeywords(schema, indent);

    // Handle different types
    switch (schema.type) {
      case 'object':
        explanation += this.explainObjectSchema(schema, indent);
        break;
      case 'array':
        explanation += this.explainArraySchema(schema, indent);
        break;
      case 'string':
        explanation += this.explainStringSchema(schema, indent);
        break;
      case 'number':
      case 'integer':
        explanation += this.explainNumberSchema(schema, indent);
        break;
      case 'boolean':
        explanation += `${indent}This is a boolean value (true or false).\n`;
        break;
      default:
        if (schema.$ref) {
          explanation += `${indent}This references another schema: ${schema.$ref}\n`;
        } else if (schema.if) {
          explanation += this.explainConditionalSchema(schema, indent);
        } else {
          // Handle schemas with no type but with constraints (like allOf sub-schemas)
          // These are partial schemas that add constraints to parent schemas
        }
    }

    return explanation;
  }

  private explainAllOfSchema(schema: any, indent: string): string {
    let explanation = '';

    // First explain the base type if present
    if (schema.type) {
      explanation += `${indent}This is a ${schema.type}`;
      if (schema.title) {
        explanation += ` (${schema.title})`;
      }
      explanation += ' that must satisfy all of the following requirements:\n';
    } else {
      explanation += `${indent}This must satisfy all of the following requirements:\n`;
    }

    // Description
    if (schema.description) {
      explanation += `${indent}${schema.description}\n`;
    }

    // Handle base constraints before allOf
    explanation += this.explainConstraintKeywords(schema, indent);

    // List all requirements
    schema.allOf.forEach((subSchema: any, index: number) => {
      explanation += `${indent}  Requirement ${index + 1}: ${this.explainSchema(subSchema, indent + '    ').trim()}\n`;
    });

    // Handle type-specific logic after allOf
    if (schema.type) {
      switch (schema.type) {
        case 'object':
          explanation += this.explainObjectSchema(schema, indent);
          break;
        case 'array':
          explanation += this.explainArraySchema(schema, indent);
          break;
        case 'string':
          explanation += this.explainStringSchema(schema, indent);
          break;
        case 'number':
        case 'integer':
          explanation += this.explainNumberSchema(schema, indent);
          break;
      }
    }

    return explanation;
  }

  private explainOneOfSchema(schema: any, indent: string): string {
    let explanation = '';

    if (schema.type) {
      explanation += `${indent}This is a ${schema.type} that must match exactly one of the following options:\n`;
    } else {
      explanation += `${indent}This must match exactly one of the following options:\n`;
    }

    if (schema.description) {
      explanation += `${indent}${schema.description}\n`;
    }

    schema.oneOf.forEach((subSchema: any, index: number) => {
      explanation += `${indent}  Option ${index + 1}: ${this.explainSchema(subSchema, indent + '    ').trim()}\n`;
    });

    return explanation;
  }

  private explainAnyOfSchema(schema: any, indent: string): string {
    let explanation = '';

    if (schema.type) {
      explanation += `${indent}This is a ${schema.type} that must match at least one of the following options:\n`;
    } else {
      explanation += `${indent}This must match at least one of the following options:\n`;
    }

    if (schema.description) {
      explanation += `${indent}${schema.description}\n`;
    }

    schema.anyOf.forEach((subSchema: any, index: number) => {
      explanation += `${indent}  Option ${index + 1}: ${this.explainSchema(subSchema, indent + '    ').trim()}\n`;
    });

    return explanation;
  }

  private explainObjectSchema(schema: any, indent: string): string {
    let explanation = '';

    if (schema.properties) {
      const propCount = Object.keys(schema.properties).length;
      explanation += `${indent}It has ${propCount} propert${propCount !== 1 ? 'ies' : 'y'}:\n`;

      const required = schema.required || [];
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = required.includes(propName);
        explanation += `${indent}  - ${propName}${isRequired ? ' (required)' : ' (optional)'}: ${this.explainSchema(propSchema, indent + '    ').trim()}\n`;
      }
    }

    if (schema.patternProperties) {
      explanation += `${indent}Pattern properties:\n`;
      for (const [pattern, propSchema] of Object.entries(schema.patternProperties)) {
        explanation += `${indent}  Properties matching "${pattern}" must match: ${this.explainSchema(propSchema, indent + '    ').trim()}\n`;
      }
    }

    if (schema.propertyNames) {
      explanation += `${indent}Property names must match: ${this.explainSchema(schema.propertyNames, indent + '  ').trim()}\n`;
    }

    if (schema.additionalProperties === false) {
      explanation += `${indent}No additional properties are allowed.\n`;
    } else if (schema.additionalProperties) {
      explanation += `${indent}Additional properties are allowed`;
      if (typeof schema.additionalProperties === 'object') {
        explanation += ` and must match: ${this.explainSchema(schema.additionalProperties, indent + '  ').trim()}\n`;
      } else {
        explanation += '.\n';
      }
    }

    // Handle both old and new dependency formats
    if (schema.dependencies) {
      explanation += `${indent}Dependencies:\n`;
      for (const [prop, deps] of Object.entries(schema.dependencies)) {
        if (Array.isArray(deps)) {
          explanation += `${indent}  If ${prop} is present, these properties are also required: ${deps.join(', ')}\n`;
        } else {
          explanation += `${indent}  If ${prop} is present, it must match: ${this.explainSchema(deps, indent + '    ').trim()}\n`;
        }
      }
    }

    if (schema.dependentRequired) {
      explanation += `${indent}Dependent required properties:\n`;
      for (const [prop, requiredProps] of Object.entries(schema.dependentRequired as Record<string, string[]>)) {
        explanation += `${indent}  If ${prop} is present, these properties are also required: ${requiredProps.join(', ')}\n`;
      }
    }

    if (schema.dependentSchemas) {
      explanation += `${indent}Dependent schemas:\n`;
      for (const [prop, depSchema] of Object.entries(schema.dependentSchemas)) {
        explanation += `${indent}  If ${prop} is present, the data must also match: ${this.explainSchema(depSchema, indent + '    ').trim()}\n`;
      }
    }

    return explanation;
  }

  private explainArraySchema(schema: any, indent: string): string {
    let explanation = '';

    if (schema.items) {
      if (Array.isArray(schema.items)) {
        explanation += `${indent}Items at specific positions:\n`;
        schema.items.forEach((itemSchema: any, index: number) => {
          explanation += `${indent}  Position ${index}: ${this.explainSchema(itemSchema, indent + '    ').trim()}\n`;
        });
      } else {
        explanation += `${indent}All items: ${this.explainSchema(schema.items, indent + '  ').trim()}\n`;
      }
    }

    if (schema.additionalItems !== undefined && Array.isArray(schema.items)) {
      if (schema.additionalItems === false) {
        explanation += `${indent}No additional items beyond the specified positions are allowed.\n`;
      } else if (typeof schema.additionalItems === 'object') {
        explanation += `${indent}Additional items must match: ${this.explainSchema(schema.additionalItems, indent + '  ').trim()}\n`;
      }
    }

    return explanation;
  }

  private explainStringSchema(schema: any, indent: string): string {
    let explanation = '';

    if (schema.enum) {
      explanation += `${indent}Allowed values: ${schema.enum.map((v: any) => JSON.stringify(v)).join(', ')}\n`;
    }

    return explanation;
  }

  private explainNumberSchema(schema: any, indent: string): string {
    let explanation = '';

    if (schema.enum) {
      explanation += `${indent}Allowed values: ${schema.enum.map((v: any) => JSON.stringify(v)).join(', ')}\n`;
    }

    return explanation;
  }

  private explainConditionalSchema(schema: any, indent: string): string {
    let explanation = `${indent}Conditional validation:\n`;

    if (schema.if) {
      explanation += `${indent}If the data matches: ${this.explainSchema(schema.if, indent + '  ').trim()}\n`;
    }

    if (schema.then) {
      explanation += `${indent}Then it must also match: ${this.explainSchema(schema.then, indent + '  ').trim()}\n`;
    }

    if (schema.else) {
      explanation += `${indent}Otherwise it must match: ${this.explainSchema(schema.else, indent + '  ').trim()}\n`;
    }

    return explanation;
  }

  private explainConstraintKeywords(schema: any, indent: string): string {
    let explanation = '';

    // Array constraints
    if (schema.contains) {
      explanation += `${indent}Must contain at least one item matching: ${this.explainSchema(schema.contains, indent + '  ').trim()}\n`;
    }

    if (schema.minContains !== undefined) {
      explanation += `${indent}Must contain at least ${schema.minContains} item${schema.minContains !== 1 ? 's' : ''} matching the contains schema.\n`;
    }

    if (schema.maxContains !== undefined) {
      explanation += `${indent}Must contain at most ${schema.maxContains} item${schema.maxContains !== 1 ? 's' : ''} matching the contains schema.\n`;
    }

    if (schema.minItems !== undefined) {
      explanation += `${indent}Minimum ${schema.minItems} item${schema.minItems !== 1 ? 's' : ''}.\n`;
    }

    if (schema.maxItems !== undefined) {
      explanation += `${indent}Maximum ${schema.maxItems} item${schema.maxItems !== 1 ? 's' : ''}.\n`;
    }

    if (schema.uniqueItems) {
      explanation += `${indent}All items must be unique.\n`;
    }

    // String constraints
    if (schema.minLength !== undefined) {
      explanation += `${indent}Minimum length ${schema.minLength}.\n`;
    }

    if (schema.maxLength !== undefined) {
      explanation += `${indent}Maximum length ${schema.maxLength}.\n`;
    }

    if (schema.pattern) {
      explanation += `${indent}Must match pattern: ${schema.pattern}\n`;
    }

    // Number constraints
    if (schema.minimum !== undefined) {
      explanation += `${indent}Minimum value ${schema.minimum} (inclusive).\n`;
    }

    if (schema.exclusiveMinimum !== undefined) {
      explanation += `${indent}Minimum value ${schema.exclusiveMinimum} (exclusive).\n`;
    }

    if (schema.maximum !== undefined) {
      explanation += `${indent}Maximum value ${schema.maximum} (inclusive).\n`;
    }

    if (schema.exclusiveMaximum !== undefined) {
      explanation += `${indent}Maximum value ${schema.exclusiveMaximum} (exclusive).\n`;
    }

    if (schema.multipleOf !== undefined) {
      explanation += `${indent}Must be a multiple of ${schema.multipleOf}.\n`;
    }

    // Object constraints
    if (schema.minProperties !== undefined) {
      explanation += `${indent}Minimum ${schema.minProperties} propert${schema.minProperties !== 1 ? 'ies' : 'y'}.\n`;
    }

    if (schema.maxProperties !== undefined) {
      explanation += `${indent}Maximum ${schema.maxProperties} propert${schema.maxProperties !== 1 ? 'ies' : 'y'}.\n`;
    }

    return explanation;
  }
}

/**
 * Convenience function to explain a schema with default options
 */
export function explainJsonSchema(schema: any): string {
  const explainer = new SchemaExplainer();
  return explainer.explainSchema(schema);
}