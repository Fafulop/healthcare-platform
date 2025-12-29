/**
 * Generate URL-friendly slug from title
 * Handles Spanish characters and removes accents
 *
 * Example:
 * "¿Cómo Cuidar Tu Piel?" → "como-cuidar-tu-piel"
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    // Remove leading/trailing whitespace
    .trim()
    // Normalize Unicode to decompose accents
    .normalize('NFD')
    // Remove accent marks
    .replace(/[\u0300-\u036f]/g, '')
    // Remove special characters except spaces and hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  // Must be lowercase letters, numbers, and hyphens only
  // Must not start or end with hyphen
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

/**
 * Generate unique slug by appending number if needed
 */
export function makeUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
