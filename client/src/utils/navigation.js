/**
 * Returns a validated internal app path (including optional query string and hash)
 * from a React Router location object, preventing open or protocol-relative redirects.
 */
export function getSafeInternalRedirect(from, fallback = '/') {
  if (!from || typeof from.pathname !== 'string') {
    return fallback;
  }

  const { pathname, search = '', hash = '' } = from;
  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.startsWith('/\\') ||
    pathname.includes('\\')
  ) {
    return fallback;
  }

  const safeSearch =
    typeof search === 'string' && (search === '' || search.startsWith('?'))
      ? search
      : '';
  const safeHash =
    typeof hash === 'string' && (hash === '' || hash.startsWith('#'))
      ? hash
      : '';

  return `${pathname}${safeSearch}${safeHash}`;
}
