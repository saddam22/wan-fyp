# Acceptance Criteria

## Project-level (MASTER INSTRUCTION §10)

1. All 18 modules assessed. — _Phase 0: done (FEATURE_TRACEABILITY_MATRIX)_
2. Every submodule has a recorded status. — _Phase 0: done_
3. Reusable modules integrated where appropriate.
4. Missing dependencies and external APIs documented. — _Phase 0: MODULE_INVENTORY §3_
5. WAN authentication and access control work.
6. Student and mentor workflows work end to end.
7. Matching prevents duplicate assignment (concurrency test).
8. File submission and revisions work.
9. Payments and commission accounting consistent (ledger balances).
10. Payout controls enforced server-side.
11. Admin permissions restricted.
12. Communication works via selected integrations.
13. All frontend pages complete and responsive.
14. No feature silently omitted.
15. Automated tests pass.
16. Production builds succeed.
17. Security and deployment checks complete.
18. Documentation current.
19. No unresolved critical issue.
20. Owner approval of final release.

## Module-level criteria (examples; each feature row gets one when built)

| Module | Criterion                                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| M02    | A hub-authenticated user with no EduKhata role can reach only onboarding/access pages; API returns 403 for any role route        |
| M06    | 20 concurrent accept requests on one offer → exactly one 200, nineteen 409; order has one mentor; history has one assignment row |
| M07    | Same TrxID on two payments → second rejected by DB constraint; approving a payment twice → 409, ledger unchanged                 |
| M07    | Sum of ledger debits = credits for every transaction id; commission = round(amount × rate stored on order)                       |
| M07    | Payout request replayed with same idempotency key → one payout                                                                   |
| M08    | Free revisions exhausted → revision request requires paid extra or is refused per config                                         |
| M10    | Guardian sees only linked children; unlinking removes access immediately                                                         |
| M12    | Accountant cannot open user management, roles or settings (403)                                                                  |
| M17    | Every API route has an authorization test for an unauthorized role                                                               |
