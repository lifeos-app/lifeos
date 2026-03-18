/**
 * Prepend the Vite base URL to static asset paths.
 * In web mode base is "/app/", in Tauri it's "./".
 */
export function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  // Remove leading slash from path if base already ends with one
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${cleanPath}`;
}
