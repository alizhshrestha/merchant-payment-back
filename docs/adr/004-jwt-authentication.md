# ADR 004: Short-lived JWT access tokens and default route protection

- Status: Accepted
- Date: 2026-11-18

## Context

Seeded employee accounts need a login flow and authenticated routes. Role and
object-level authorization will follow as merchant endpoints are implemented.

## Decision

Use `@nestjs/jwt` to issue HS256 access tokens with a 15-minute lifetime,
issuer `merchant-payment-back`, audience `merchant-payment-api`, and user UUID
in `sub`. The API requires `JWT_SECRET` as 32 random bytes encoded in 64 hex
characters. Decode the secret to bytes for signing and verification. Local secrets
are generated into ignored `.env`; `.env.example` contains an empty placeholder.

`POST /auth/login` validates its body, normalizes email, verifies the stored scrypt
hash, and returns an access token plus a whitelist of public user fields. Unknown
accounts perform a dummy hash verification and receive the same generic 401 as
incorrect passwords. Login request bodies and tokens are not logged by this code.

A global JWT guard protects routes by default. Only the root smoke-test route and
login are explicitly public. Protected requests require the Authorization Bearer
header; query-string tokens are not accepted. Verification restricts the algorithm,
issuer, audience, age and expiry, validates the subject UUID, and loads the current
user from PostgreSQL. It rejects deleted/nonexistent users. Role claims in tokens
are not trusted; the request user has the current database role.

`GET /auth/me` returns only id, name, email and role. Successful auth responses use
`Cache-Control: no-store`. A route-local throttler limits login to ten requests per
IP per 60 seconds, including malformed requests. Express proxy trust is not enabled,
so user-supplied forwarded IP headers cannot change the limiter's client identity.

## Alternatives and consequences

A direct Nest guard avoids adding Passport for this single token mechanism.
A database lookup on protected requests adds a query but keeps user existence and
roles current. JWT secrets are required for API startup, but migration and seed
commands continue to validate only their own configuration.

Rate limits currently use process memory, suitable for this single-instance local
project. Multiple instances require shared limiter storage and explicit trusted
proxy configuration. Deployments must serve credentials and tokens over HTTPS.

There are no refresh tokens, logout revocation records, or password-reset endpoints
in this stage. Clients log in again after expiry. Changing a password does not yet
revoke an existing token; rotating the signing secret invalidates all tokens.
Authentication does not by itself authorize reviewer decisions or data ownership.
Those rules belong to the next authorization stage.

## Validation

End-to-end tests use a disposable database and cover all three roles, generic login
failures, input validation, protected-by-default routes, absent/malformed/expired
and incorrectly signed tokens, issuer/audience/algorithm restrictions, missing
expiry, removed users, current roles, and login throttling. Unit tests validate
signing-secret configuration.

## References

- [NestJS JWT authentication](https://docs.nestjs.com/v11/techniques/authentication)
- [NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting)
