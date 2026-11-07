/**
 * Asks the browser to keep this site's IndexedDB data when storage is low.
 * Best effort: browsers may refuse, and the call is missing in some contexts.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
