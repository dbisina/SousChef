# shared

Plain TypeScript types and constants used by both the app and `server/`.

Rules:

- No runtime dependencies (no zod, no libraries). The server validates requests with its own zod schemas that are
  declared against these types (`z.ZodType<RegisterRequest>`), so a change here fails the server build until the
  validator agrees. This avoids two copies of zod being loaded.
- Types describe what goes over the wire. Dates are ISO strings.
- Import from the app as `@/shared/...`; from the server as `@shared/...`.
