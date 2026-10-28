# Payment & Commission

Status: **design only** (Phase 5).

## ICTSpark's existing manual workflow (read from `server/src/controllers/sendmoney.controller.js`)

1. A `Payment` is created with `provider: "sendmoney"`, `status: "pending"`, unique `invoiceNo`.
2. `GET /api/payments/methods` lists configured options (bKash/Nagad/Rocket personal/agent/merchant numbers, bank accounts).
3. Payer submits `POST /api/payments/:id/manual { account, sender, trxId }`:
   - Bengali digits normalized; mobile sender must match `01[3-9]…`; TrxID `[A-Z0-9]{6,20}` (bank: sender name + `[A-Z0-9]{4,30}`).
   - Rejects if payment not pending (409).
   - Rejects TrxID already used on another payment (409) — **application-level check only**.
   - Admins and super admins get a notification.
4. Admin `GET /api/admin/payments/verify` → `POST /api/admin/payments/:id/verify { approve, note }`:
   - approve → `status = paid`, `providerTrxId = trxId`, `verifiedAt/By`, then `applyPaymentResult` (unlock service, referral commission).
   - reject → note stored, payer notified and may resubmit.
5. Gateways (bKash/Nagad/Rocket/SSLCommerz) have callback + IPN handlers; merchant credentials are not in the repo.

## What EduKhata keeps, and what it fixes

| ICTSpark behaviour | EduKhata |
|---|---|
| Method list, instructions, TrxID + sender, Bengali digit normalization | Keep |
| Reject → resubmit | Keep |
| Duplicate TrxID check in code | **DB unique index** on `(method, normalized_trx_id)` |
| `/:id/manual` has no auth (guest checkout) | Require login + ownership (payer or linked guardian) |
| No proof screenshot | Add optional proof upload (private storage, image/PDF sniffed) |
| Admin verifies alone | **Accountant verifies**; amounts ≥ configurable threshold need a second approver (maker-checker, like ad-platform funding) |
| Status set, side effects after | Status change + ledger entries + order transition in **one transaction** |
| No accountant role | `accountant` role, no access to user management or settings |

## Money model

- Amounts in integer paisa (`amount_minor bigint`) + `currency char(3)`; BDT first.
- On payment approval, ledger (double-entry, must balance):
  - Dr `cash:manual:<account>` / Cr `liability:order_funds:<order>` (full amount)
- On order closure:
  - Dr `liability:order_funds` / Cr `revenue:commission` (commission_rate × amount)
  - Dr `liability:order_funds` / Cr `liability:mentor_payable:<mentor>` (remainder)
- Payout paid: Dr `liability:mentor_payable` / Cr `cash:<account>`.
- Refund: reverses the unreleased parts; partial refunds split proportionally (policy Q6).
- `commission_rate` (default **0.20**) is configurable in settings and **copied onto the order** when paid.

## Open policy decisions (needed before Phase 5 is finalized)

| ID | Question |
|---|---|
| Q5 | "Secure Payment & Money Hold" in the mockup: the platform receives funds and releases the mentor share after approval. No escrow provider is verified — is holding customer funds acceptable for your business registration in Bangladesh? (legal check) |
| Q6 | Refund rules: before assignment = full; after delivery = ? ; partial refunds? |
| Q7 | Who bears gateway fees (when gateways are added)? VAT/tax on commission? |
| Q8 | Mentor payout holding period (e.g. 7 days after closure) and minimum payout |
| Q9 | Paid extra revisions price; coupon funding (platform-only or mentor-shared) |
