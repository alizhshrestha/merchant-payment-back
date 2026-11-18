# ADR 003: Password hashing and local seed users

- Status: Accepted
- Date: 2026-11-18

## Context

We need one local account per role for upcoming JWT login and permission tests.
Passwords must not be stored as plaintext, and rerunning setup must not reset
accounts or elevate an existing user's role.

## Decision

Use Node.js asynchronous `crypto.scrypt` through a reusable `PasswordService`.
Use N=32768, r=8, p=3, a 16-byte random salt per password, a 64-byte derived key,
and a 64 MiB memory ceiling per operation. Store a versioned string containing
algorithm, parameters, salt, and derived key in `password_hash`.
Verification validates the stored format, derives the candidate key asynchronously,
and compares keys with `timingSafeEqual`. Unknown formats and oversized inputs are
rejected. This implementation accepts only its current version and parameters.

The seed command requires explicit 15–128 character passwords from local environment
settings. `.env.example` contains empty placeholders, not shared credentials.
Generated local passwords are kept only in ignored `.env` and are never logged.
The command accepts development/test environments only and requires applied migrations.
It creates admin@merchant.local, sales@merchant.local, and reviewer@merchant.local.

Seeding runs in a transaction with an advisory lock to serialize concurrent runs.
Case-insensitive email lookup reuses matching accounts without changing their hash,
name, or role. A role conflict fails and rolls back new inserts. Changing a seed
password setting is not a password-reset mechanism.

## Alternatives and consequences

Argon2id is the preferred general recommendation from OWASP; scrypt is also an
approved option. We use the stable built-in Node.js implementation to avoid an
additional native dependency for this time-boxed project. The selected parameters
match one of OWASP's listed scrypt configurations. Hashing still consumes CPU and
memory; asynchronous execution avoids blocking the main JavaScript thread but
requires login rate limiting in the authentication stage.

No automatic account seeding happens on application startup. This command is only
for local setup, not production account provisioning. JWT login, authorization,
rate limiting, and password resets are separate steps.

## Verification

Tests verify password matching, incorrect passwords, random salts, malformed hash
rejection, role creation, rerun preservation, concurrent seeding, invalid settings,
and rollback on role conflicts. Database seed tests run in a disposable database.

## References

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html)
