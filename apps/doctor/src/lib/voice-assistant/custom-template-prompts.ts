/**
 * Dynamic Prompt Generation for Custom Templates
 *
 * Generates LLM prompts dynamically based on custom template field definitions.
 */

import type { FieldDefinition } from '@/types/custom-encounter';

/**
 * Generate JSON schema from custom field definitions
 */
function generateJSONSchema(fields: FieldDefinition[]): string {
  const schemaLines: string[] = ['{'];

  // Sort fields by order
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  sortedFields.forEach((field, index) => {
    const isLast = index === sortedFields.length - 1;
    let typeAnnotation = '';

    // Determine TypeScript type annotation
    switch (field.type) {
      case 'text':
      case 'textarea':
        typeAnnotation = 'string | null';
        break;
      case 'number':
        typeAnnotation = 'number | null';
        break;
      case 'date':
        typeAnnotation = 'string | null  // ISO format: YYYY-MM-DD';
        break;
      case 'time':
        typeAnnotation = 'string | null  // Format: HH:MM';
        break;
      case 'dropdown':
      case 'radio':
        if (field.options && field.options.length > 0) {
          const optionsStr = field.options.map(opt => `"${opt}"`).join(' | ');
          typeAnnotation = `${optionsStr} | null`;
        } else {
          typeAnnotation = 'string | null';
        }
        break;
      case 'checkbox':
        typeAnnotation = 'boolean | null';
        break;
      case 'file':
        typeAnnotation = 'string | null  // File reference or URL';
        break;
      default:
        typeAnnotation = 'any | null';
    }

    // Add comment with Spanish label for context
    const comment = field.labelEs ? ` // ${field.labelEs}` : ` // ${field.label}`;
    const comma = isLast ? '' : ',';

    schemaLines.push(`  "${field.name}": ${typeAnnotation}${comment}${comma}`);
  });

  schemaLines.push('}');

  return schemaLines.join('\n');
}

/**
 * Generate field extraction guidelines
 */
function generateFieldGuidelines(fields: FieldDefinition[]): string {
  const guidelines: string[] = [];

  // Group fields by type
  const fieldsByType = fields.reduce((acc, field) => {
    if (!acc[field.type]) acc[field.type] = [];
    acc[field.type].push(field);
    return acc;
  }, {} as Record<string, FieldDefinition[]>);

  // Add guidelines for each type
  if (fieldsByType['date']) {
    guidelines.push('### Date Fields');
    guidelines.push('- Convert spoken dates to ISO format YYYY-MM-DD');
    guidelines.push('- "quince de marzo" → "2026-03-15" (using current year)');
    guidelines.push('- "15 de marzo del 2025" → "2025-03-15"');
    fieldsByType['date'].forEach(field => {
      guidelines.push(`- "${field.name}": ${field.labelEs || field.label}`);
    });
    guidelines.push('');
  }

  if (fieldsByType['time']) {
    guidelines.push('### Time Fields');
    guidelines.push('- Convert to 24-hour format HH:MM');
    guidelines.push('- "3 de la tarde" → "15:00"');
    guidelines.push('- "nueve y media de la mañana" → "09:30"');
    fieldsByType['time'].forEach(field => {
      guidelines.push(`- "${field.name}": ${field.labelEs || field.label}`);
    });
    guidelines.push('');
  }

  if (fieldsByType['number']) {
    guidelines.push('### Number Fields');
    fieldsByType['number'].forEach(field => {
      const rangeInfo = field.min !== undefined || field.max !== undefined
        ? ` (${field.min !== undefined ? `min: ${field.min}` : ''}${field.min !== undefined && field.max !== undefined ? ', ' : ''}${field.max !== undefined ? `max: ${field.max}` : ''})`
        : '';
      guidelines.push(`- "${field.name}": ${field.labelEs || field.label}${rangeInfo}`);
      guidelines.push(`  - Extract as number (integer or decimal)`);
    });
    guidelines.push('');
  }

  if (fieldsByType['dropdown'] || fieldsByType['radio']) {
    guidelines.push('### Dropdown/Radio Fields (Categorical)');
    const categoricalFields = [...(fieldsByType['dropdown'] || []), ...(fieldsByType['radio'] || [])];
    categoricalFields.forEach(field => {
      guidelines.push(`- "${field.name}": ${field.labelEs || field.label}`);
      if (field.options && field.options.length > 0) {
        guidelines.push(`  - Valid values: ${field.options.map(o => `"${o}"`).join(', ')}`);
        guidelines.push(`  - Match the doctor's words to the closest valid option`);
      }
    });
    guidelines.push('');
  }

  if (fieldsByType['checkbox']) {
    guidelines.push('### Checkbox Fields (Boolean)');
    fieldsByType['checkbox'].forEach(field => {
      guidelines.push(`- "${field.name}": ${field.labelEs || field.label}`);
      guidelines.push(`  - Extract as boolean: true if mentioned/confirmed, false if explicitly negated, null if not mentioned`);
    });
    guidelines.push('');
  }

  if (fieldsByType['text'] || fieldsByType['textarea']) {
    guidelines.push('### Text Fields');
    const textFields = [...(fieldsByType['text'] || []), ...(fieldsByType['textarea'] || [])];
    textFields.forEach(field => {
      guidelines.push(`- "${field.name}": ${field.labelEs || field.label}`);
      if (field.placeholder) {
        guidelines.push(`  - Context: ${field.placeholder}`);
      }
    });
    guidelines.push('');
  }

  return guidelines.join('\n');
}

/**
 * Generate field vocabulary mapping (Spanish labels to field names)
 */
function generateFieldVocabulary(fields: FieldDefinition[]): string {
  const vocab: string[] = ['### Spanish Field Vocabulary (for voice recognition)'];
  vocab.push('When the doctor mentions these Spanish terms, map to the corresponding field:');
  vocab.push('');

  fields.forEach(field => {
    if (field.labelEs && field.labelEs !== field.label) {
      vocab.push(`- "${field.labelEs}" → "${field.name}"`);
    }
  });

  return vocab.join('\n');
}

/**
 * Generate complete system prompt for custom template
 */
export function generateCustomTemplateSystemPrompt(
  templateName: string,
  templateDescription: string | undefined,
  fields: FieldDefinition[]
): string {
  const basePrompt = `You are a clinical documentation assistant for a medical records system in Mexico.
Your ONLY task is to extract and structure information from a doctor's voice dictation into a specific JSON format.

## CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY

1. **EXTRACT ONLY EXPLICIT INFORMATION**
   - Only include data that is clearly stated or directly implied in the transcript
   - If something is ambiguous, leave it as null
   - If you're unsure about ANY field, use null

2. **NEVER INVENT DATA**
   - Do NOT guess, infer, or hallucinate any information
   - Do NOT fill in "typical" or "common" values
   - Do NOT assume anything not explicitly stated
   - Empty/null is ALWAYS better than a guess

3. **PRESERVE MEDICAL TERMINOLOGY**
   - Keep medical terms exactly as dictated (Spanish)
   - Do not translate, simplify, or "correct" medical terms
   - Preserve abbreviations used by the doctor

4. **OUTPUT FORMAT**
   - Return ONLY valid JSON - no markdown, no explanation
   - Use null for missing/uncertain fields (not empty string, not omitted)
   - Follow the exact field names provided in the schema

5. **NO CLINICAL DECISIONS**
   - You structure information, you do not diagnose
   - You do not add recommendations
   - You do not modify or "improve" clinical content

## LANGUAGE
- Input: Spanish (Mexican medical Spanish)
- Output: JSON with Spanish text values

## RESPONSE FORMAT
Return ONLY the JSON object. No preamble, no explanation, no markdown code blocks.

## YOUR TASK: STRUCTURE ${templateName.toUpperCase()} INFORMATION

${templateDescription ? `**Template Description:** ${templateDescription}\n\n` : ''}Extract information from the transcript and return a JSON object following the schema below.
Use null for any field not explicitly mentioned.

## OUTPUT SCHEMA

${generateJSONSchema(fields)}

## FIELD EXTRACTION GUIDELINES

${generateFieldVocabulary(fields)}

${generateFieldGuidelines(fields)}

## REQUIRED FIELDS
${fields.filter(f => f.required).length > 0
  ? `The following fields are required. If not mentioned, use null but note that the form may reject the submission:\n${fields.filter(f => f.required).map(f => `- ${f.name}: ${f.labelEs || f.label}`).join('\n')}`
  : 'No fields are strictly required. Use null for any field not mentioned.'}

## IMPORTANT REMINDERS
- Return ONLY the JSON object
- Use exact field names from the schema
- Use null for any field not mentioned or uncertain
- Do NOT invent or guess any information
- Preserve medical terminology exactly as dictated
`;

  return basePrompt;
}

/**
 * Get all extractable field names from custom template
 */
export function getCustomTemplateFields(fields: FieldDefinition[]): string[] {
  return fields.map(f => f.name);
}
