/**
 * Verifies that the incoming request carries the expected CRON_SECRET value
 * in the `x-cron-secret` header.
 *
 * Kong (the local API gateway) strips the `Authorization` header before it
 * reaches the Deno function. `x-cron-secret` is a custom header that Kong
 * passes through untouched, making it the correct auth mechanism for every
 * cron-triggered Edge Function in this project.
 *
 * Returns `true` when the header is present and matches `CRON_SECRET`.
 * Returns `false` when the header is absent, empty, or does not match —
 * the caller must immediately return a 401 response.
 */
export function verifyCronSecret(req: Request): boolean {
  const token = req.headers.get('x-cron-secret') ?? '';
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  if (!cronSecret) {
    console.error('[cron-auth] CRON_SECRET env is not set — all cron calls will be rejected');
  }
  return token !== '' && token === cronSecret;
}
