/**
 * Shared validation for custom-template field definitions.
 *
 * Used by:
 * - POST/PUT /api/custom-templates (FormBuilder save — fields carry client ids)
 * - POST /api/form-builder-chat (AI-generated fields — ids are generated later
 *   by the client, so `requireId: false`)
 *
 * Returns an error string, or null when valid.
 */

const VALID_TYPES = ['text', 'textarea', 'number', 'date', 'time', 'dropdown', 'radio', 'checkbox', 'file'];

export function validateCustomFields(
  fields: any[],
  options: { requireId?: boolean } = {}
): string | null {
  const { requireId = true } = options;

  if (fields.length === 0) {
    return 'At least one field is required';
  }

  if (fields.length > 50) {
    return 'Maximum 50 fields allowed';
  }

  const fieldNames = new Set<string>();

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];

    if (requireId && (!field.id || typeof field.id !== 'string')) {
      return `Field at index ${i}: id is required`;
    }

    if (!field.name || typeof field.name !== 'string') {
      return `Field at index ${i}: name is required`;
    }

    if (fieldNames.has(field.name)) {
      return `Duplicate field name: ${field.name}`;
    }
    fieldNames.add(field.name);

    if (!/^[a-z][a-zA-Z0-9]*$/.test(field.name)) {
      return `Field "${field.name}": name must be camelCase (start with lowercase, no spaces)`;
    }

    if (!field.label || typeof field.label !== 'string') {
      return `Field "${field.name}": label is required`;
    }

    if (!field.type) {
      return `Field "${field.name}": type is required`;
    }

    if (!VALID_TYPES.includes(field.type)) {
      return `Field "${field.name}": invalid type "${field.type}"`;
    }

    if (typeof field.required !== 'boolean') {
      return `Field "${field.name}": required must be boolean`;
    }

    if (typeof field.order !== 'number') {
      return `Field "${field.name}": order must be number`;
    }

    if ((field.type === 'dropdown' || field.type === 'radio') && !field.options) {
      return `Field "${field.name}": options array required for ${field.type}`;
    }

    if (field.options && !Array.isArray(field.options)) {
      return `Field "${field.name}": options must be an array`;
    }

    if (field.options && field.options.length === 0) {
      return `Field "${field.name}": options array cannot be empty`;
    }
  }

  return null;
}
