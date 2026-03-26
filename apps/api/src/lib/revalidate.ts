/**
 * Triggers on-demand ISR revalidation on the public app.
 * Fire-and-forget: call without await — errors are logged but never thrown.
 */
export function revalidatePublicPath(path: string): void {
  const publicAppUrl = process.env.PUBLIC_APP_URL;
  const secret = process.env.REVALIDATE_SECRET;

  if (!publicAppUrl) {
    console.warn('[REVALIDATE] PUBLIC_APP_URL not set, skipping revalidation for:', path);
    return;
  }

  const url = `${publicAppUrl}/api/revalidate?path=${encodeURIComponent(path)}`;

  fetch(url, {
    method: 'POST',
    headers: secret ? { 'x-revalidate-secret': secret } : {},
    signal: AbortSignal.timeout(5000), // 5 second timeout — never blocks caller
  })
    .then((res) => {
      if (res.ok) {
        console.log(`[REVALIDATE] ✅ Revalidated: ${path}`);
      } else {
        console.warn(`[REVALIDATE] ⚠️ Failed (${res.status}) for: ${path}`);
      }
    })
    .catch((err) => {
      console.warn(`[REVALIDATE] ⚠️ Error revalidating ${path}:`, err);
    });
}
