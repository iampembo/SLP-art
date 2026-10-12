// Types for the `cloudflare:workers` runtime module (provided by the
// @astrojs/cloudflare adapter at build/dev time on Workers).
declare module 'cloudflare:workers' {
  export const env: Record<string, string | undefined>;
}
