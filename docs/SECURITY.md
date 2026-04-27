# Security Policy

## Reporting a Vulnerability

Please do **not** open a public issue for suspected security vulnerabilities.

Instead, report them privately to the maintainers with:
- a short description of the issue,
- affected area(s) (`server`, `client`, `docs-site`),
- impact assessment,
- reproduction steps or a proof of concept,
- any suggested remediation.

If you do not yet have a private maintainer contact, use the project’s primary maintainer channel and clearly mark the message as **SECURITY**.

## Supported Versions

Security fixes are intended for the current development line in this repository.
Older snapshots, forks, and unpublished local deployments may not receive coordinated fixes.

## Current Security Posture

### Authentication transport

The application now uses a **JWT in an HttpOnly cookie** for browser authentication.

Key properties:
- cookie is `HttpOnly`,
- cookie is configurable for `Secure`,
- cookie uses configurable `SameSite` (default: `Lax`),
- browser clients authenticate API requests via cookies instead of `localStorage` bearer tokens,
- `/api/auth/session` is used by the SPA to bootstrap the authenticated user after page reloads,
- `/api/auth/logout` clears the auth cookie.

This reduces XSS exposure compared with storing long-lived bearer tokens in `localStorage`.

### JWT validation

Server-side JWT validation includes:
- stable `sub` = internal user ID,
- explicit `username` claim,
- issuer validation,
- audience validation,
- rejection of tokens for deleted/unknown users,
- parity between HTTP and WebSocket authentication paths.

### OAuth hardening

GitHub OAuth uses server-issued and server-validated `state` values:
- the backend creates the OAuth `state`,
- the value is stored in an `HttpOnly` cookie,
- the callback requires the matching `state`,
- the `state` cookie is cleared after use,
- `redirect_uri` is bound during the code exchange.

### WebAuthn / Passkeys

The WebAuthn authentication start flow has been hardened to reduce username enumeration:
- the start endpoint returns a generic discoverable-credential flow,
- unknown usernames do not receive a distinct `404` response,
- if a username was supplied by the client, it is verified only after a successful assertion,
- new registrations request **discoverable credentials** (`residentKey = required`).

## Deployment Recommendations

### Required environment variables

Review and set at least:
- `PORTHOLE_JWT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `PORTHOLE_GITHUB_REDIRECT_URI`
- `PORTHOLE_ALLOWED_ORIGINS`
- `PORTHOLE_WEBAUTHN_RP_ID`
- `PORTHOLE_WEBAUTHN_RP_NAME`
- `PORTHOLE_WEBAUTHN_ORIGIN`

### Cookie settings

For HTTPS deployments, set:
- `PORTHOLE_AUTH_COOKIE_SECURE=true`

Review as needed:
- `PORTHOLE_AUTH_COOKIE_NAME`
- `PORTHOLE_AUTH_COOKIE_PATH`
- `PORTHOLE_AUTH_COOKIE_SAME_SITE`

Recommended defaults for production:
- serve the SPA and API from trusted origins only,
- prefer HTTPS everywhere,
- keep `SameSite=Lax` or stricter unless a cross-site deployment explicitly requires otherwise,
- avoid exposing the API directly to untrusted origins.

### CORS

Restrict `PORTHOLE_ALLOWED_ORIGINS` to the exact frontend origin(s) in use.
Do not leave broad wildcard-style origin settings in production.

### OAuth and WebAuthn origin consistency

Make sure these values match the deployed public origin:
- frontend/browser origin,
- GitHub OAuth callback URL,
- WebAuthn RP ID,
- WebAuthn origin.

A mismatch here will commonly break login or weaken assumptions about trusted origins.

## Operational Notes

- Rotate `PORTHOLE_JWT_SECRET` if token leakage is suspected.
- Clearing the auth cookie logs the browser session out, but already-issued JWTs remain cryptographically valid until expiry unless the signing secret is rotated.
- WebSocket connections rely on the authenticated browser handshake; verify reverse proxies forward upgrade requests correctly.

## Out of Scope / Known Limits

This repository currently uses self-contained JWTs rather than a server-side revocation store.
That keeps the system simple, but immediate revocation of all already-issued tokens is not available without secret rotation or expiry.

