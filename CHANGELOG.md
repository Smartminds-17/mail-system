# Changelog

## [1.4.1] - 2026-07-15

### Fixed
- Server startup now applies pending database migrations automatically and only once.

## [1.4.0] - 2026-07-15

### Added
- Campaigns can be scheduled, sent immediately, or cancelled before sending.
- A restart-safe scheduler claims due campaigns and records their final delivery state.
- Campaign deletion now uses an accessible, branded confirmation dialog.

## [1.3.0] - 2026-07-15

### Added
- Campaign creation now includes recipient validation, duplicate detection, and a personalized email preview.
- Users can send a safe test message only to their own registered email address.

## [1.2.0] - 2026-07-15

### Added
- Email campaigns now check recipient mail domains before sending and skip placeholder or missing domains.
- Campaign results now explain accepted messages, invalid addresses, and provider failures.

## [1.1.0] - 2026-07-15

### Security
- Removed committed runtime secrets and hard-coded Twilio credentials.
- Enforced campaign ownership for email and SMS recipient logs.
- Added strict JWT, registration, campaign, recipient, CORS, and provider configuration.
- Escaped recipient and campaign data rendered into HTML.

### Added
- Added health checking, automated tests, GitHub Actions CI, and container definitions.
- Added bounded-concurrency campaign delivery with a configurable worker limit.
- Added a modern Hanken Grotesk interface and complete sidebar navigation.

### Changed
- Separated provider integrations, validation, personalization, and configuration from routes.
- Made database startup failures explicit and non-destructive.
