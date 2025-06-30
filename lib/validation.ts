/** Basic validation helpers used throughout the app. */
/**
 * Validate whether a string is a well-formed UUID value.
 * Useful for verifying IDs before making Supabase requests.
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

