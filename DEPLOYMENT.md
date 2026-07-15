# Deployment

Promote the same tested container image through staging and production. Store all environment values in the platform secret store; never copy `.env` into an image.

Required production settings include `NODE_ENV=production`, a public HTTPS `PUBLIC_BASE_URL`, the exact frontend `CORS_ORIGIN`, a random `JWT_SECRET` of at least 32 characters, MySQL settings, and the provider credentials used by enabled channels.

Use a rolling or blue-green deployment. Before shifting traffic, apply additive migrations, check `/api/health`, register and authenticate a staging user, and create a campaign without sending it. Keep the previous image available. Roll back by directing traffic to that image; use a new forward migration for database corrections rather than rewriting an applied migration.

Configure alerts for health-check failure, elevated HTTP 5xx responses, database connection errors, and email/SMS failure rate. Provider credentials previously present in Git must be rotated before deployment.
