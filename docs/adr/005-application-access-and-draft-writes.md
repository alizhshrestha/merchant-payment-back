# ADR 005: Role-based access and scoped application writes

- Status: Accepted
- Date: 2026-11-18
- Scope: Create, list, read, and edit merchant applications

## Context

Authentication identifies a user but does not authorize access to merchant records.
We need role checks and record-level checks before adding submission and review.
The existing four-table schema supports this stage without a new migration.

## Decision

Run a global role guard after JWT authentication. `@Roles` lists allowed roles;
method declarations override controller defaults. Routes without role metadata
remain available to authenticated users unless explicitly public.

| Operation | SALES | REVIEWER | ADMIN |
| --- | --- | --- | --- |
| Create draft | Yes, owned by caller | No | Yes, owned by caller |
| List/read | Own records | Assigned records | All records |
| Edit business details | Own DRAFT / NEEDS_INFO | No | Any DRAFT / NEEDS_INFO |

Apply ownership/assignment conditions in SQL before pagination and counting.
Use the same scope for individual reads and updates. Return 404 for missing or
inaccessible records to avoid exposing record existence; reject forbidden role
operations with 403. Unauthenticated requests return 401.

Writes accept only business/contact/processing fields. Reject unknown fields,
including IDs, creator, reviewer, statuses, and version. Core details are required
on creation, following ADR 002. Partial updates must contain at least one allowed
field. Nullable contact phone can be cleared with null.

Accept monthly volume as a nonnegative decimal string with up to 13 integer digits
and two decimal places. This avoids JavaScript floating-point conversion and
PostgreSQL rounding of extra decimal places. Normalize currency to three uppercase
letters and contact email to lowercase. This is currency format validation, not
an authoritative ISO currency allowlist.

List responses use `{ data, total, page, limit }`, default page 1 / limit 20,
maximum limit 100 and page 10000, optional status filter, and stable ordering by
creation time then UUID descending.

Creation and editing write an audit event in the same database transaction. Audit
metadata contains the creation status or changed field names, not contact values.
Update transactions lock the application row before checking its state. Both
ADMIN and SALES must obey the state rule: submitted, under-review, approved and
rejected applications cannot be edited through this endpoint (409).

## Alternatives and consequences

Role checks alone cannot prevent cross-user record access. Filtering after loading
or paginating would expose counts or produce incomplete pages, so scope belongs in
the database query. Audit writes outside the transaction could leave an unaudited
change, so a failed audit insert rolls back the application write.

An admin may edit an eligible draft but cannot bypass the edit state rule. Reviewer
assignment, submission, risk processing, decisions, and audit-history endpoints
remain separate stages. There is no delete endpoint.

## Validation

Disposable-database integration tests cover role restrictions, ownership and
assignment, scoped counts and pagination, forbidden field injection, decimal and
input validation, edit state rules, audit metadata and rollback on audit failure.
