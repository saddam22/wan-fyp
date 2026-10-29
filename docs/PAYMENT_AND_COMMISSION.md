# Payment & Commission

Status: **built (Phase 5)**, `AUTH_MODE=wan`. No payment gateway is connected: money moves by manual bKash / Nagad / Rocket / bank transfer, the same way ICTSpark works today.

## Source: ICTSpark's manual workflow

Read from `server/src/controllers/sendmoney.controller.js`:

1. A pending payment is created with a unique invoice number.
2. The payer picks a configured account, sends money, and submits the sender and the TrxID.
3. ICTSpark normalises Bengali digits and checks the number and TrxID formats. It refuses a TrxID that was already used.
4. An admin approves (side effects follow) or rejects with a note (the payer may submit again).

EduKhata keeps that flow and its validation rules (`validateSubmission`, shared helpers in `@edukhata/contracts`). It closes ICTSpark's gaps:

| ICTSpark                         | EduKhata                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Duplicate TrxID checked in code  | **Unique index** `payments_trx_unique` on (method, normalised TrxID). One live payment per order or revision (unique partial index). |
| `/:id/manual` without sign-in    | Sign-in required. Only the student, or a guardian the student allowed to "pay on behalf", may pay. Everyone else gets 404.           |
| No proof                         | Optional screenshot or PDF: private storage, magic bytes checked, served with `sandbox` CSP to verifiers and the payer only.         |
| Admin verifies                   | `accountant` (or super admin) verifies. Nobody verifies their own payment, or a payment for their own order.                         |
| Status first, side effects after | Payment status, attempt row, ledger posting and the order's transition happen in **one transaction**.                                |
| Unlimited submissions            | Submissions are rate-limited per session; every attempt is kept in `payment_attempts`.                                               |

## Flow

1. **Receiving accounts.** An accountant adds them at `/accountant/accounts`, and every change is audited. Only enabled accounts are shown to payers.
2. **Pay.** The order page shows **Pay now** while the order waits for payment, or when a paid revision is due. The pay page shows the amount, the account and the order code to use as the reference. The payer submits the sender, the TrxID and an optional proof. The order moves to `payment_review`.
3. **Verify** at `/accountant/payments`:
   - **Approve:** the money is posted to the ledger. The order enters matching, or the paid revision goes to the mentor.
   - **Reject:** a reason is required. The payer is notified and may submit again, and the order goes back to `awaiting_payment`.
4. **Work.** Matching, delivery and approval follow, as in Phase 4.
5. **Approval.** When the student approves, the order is **earned**: commission goes to revenue and the mentor's share becomes **pending**.
6. **Closure.** At closure (by staff, or automatically `auto_close_days` = 7 days after approval), the mentor's share becomes **available**.
7. **Payout.** The mentor requests a payout from the available balance at `/mentor/payouts`. Only one open request is allowed, and the minimum is `min_payout_minor` (৳500). The amount is reserved at once. An accountant approves it at `/accountant/payouts`. A **different** person sends the money and records the account it left from plus the transfer reference. Nobody can handle their own payout. A rejection returns the amount to the mentor's available balance.
8. **Refund.** A refund comes from a cancellation or a dispute decision. It is recorded at once as "refunds payable". A **second** person (not the requester) approves it at `/accountant/refunds`. Then someone records the transfer back to the payer's number.
9. **Reconciliation.** `/accountant/reconciliation` shows, per receiving account, what was received, refunded and paid out, plus the book balance. Approved payments are ticked off one by one against the provider statement.
10. **Invoices.** Every approved or refunded payment has a printable invoice for the student, the payer, permitted guardians and staff.

## Ledger (double-entry, `ledger_transactions` + `ledger_entries`)

Amounts are signed integer paisa: positive is a debit, negative is a credit. Three rules are enforced by the database:

- A deferred constraint trigger requires every transaction to sum to zero.
- Entries are append-only (update and delete are refused).
- `idempotency_key` is unique, so a retried step can't post twice.

| Event                    | Debit                                                                                               | Credit                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Payment approved         | `cash:<account>`                                                                                    | `escrow:order:<id>`                         |
| Order approved (earned)  | `escrow:order:<id>`                                                                                 | `revenue:commission`, `mentor:<id>:pending` |
| Order closed (available) | `mentor:<id>:pending`                                                                               | `mentor:<id>:available`                     |
| Payout requested         | `mentor:<id>:available`                                                                             | `payouts:payable`                           |
| Payout rejected          | `payouts:payable`                                                                                   | `mentor:<id>:available`                     |
| Payout sent              | `payouts:payable`                                                                                   | `cash:<account>`                            |
| Refund decided           | `escrow:order:<id>` first; then `mentor:<id>:pending` and `revenue:commission` in the order's split | `refunds:payable`                           |
| Refund sent              | `refunds:payable`                                                                                   | `cash:<account>`                            |

**Commission.** `commission_rate` defaults to **0.20** and is a configurable setting. It is **copied onto the order** when the order is placed, so a later change never affects existing orders. The mentor's share is `floor(price × (1 − rate))`, and the commission is the remainder, so the two always add up to the price.

`/accountant/balances` and the accountant dashboard show the trial balance, which is always 0.

## Fees, refunds and tax — the rules as built

- **Provider fees.** The payer sends the exact invoice amount. Any send or cash-out charge is the payer's, as with ICTSpark. The fee for sending a payout or refund is **not modelled**: the ledger records the amount the mentor or payer receives. Recommended: the platform bears it, booked from commission. This is owner decision **Q7**.
- **Refunds:**
  - **Student cancellation.** Possible until a mentor starts work (`awaiting_payment`, `payment_review`, `matching`, `assigned`). Everything paid is refunded.
  - **Staff cancellation.** Possible at any point up to delivery, with a reason. Money still held is refunded.
  - **Disputes.** The admin decides: release to the mentor, a partial refund of any amount, or a full refund. A refund can never exceed what was paid and not yet made available. After approval, the refund takes back the mentor's pending share and the commission in the order's proportion.
  - **Payment state.** A cancellation while a payment is being checked is refused until the payment is decided. When everything paid has gone back, the payments are marked `refunded`.
- **Tax.** **No VAT is applied** (owner decision **Q19**). Invoices state "No VAT applied". If VAT registration happens later, a tax line and a `vat:payable` account are the extension point.
- **Mentor holding period.** The share becomes available at closure: 7 days after approval, or earlier if staff close the order. The minimum payout is ৳500.

## What is not built

- **Gateways.** bKash/Nagad merchant APIs and SSLCommerz are not connected, because there are no merchant credentials. ICTSpark's gateway handlers are the reference when they are added.
- **Referral rewards.** They need a reward rule (owner decision); attribution is in place.
- **Statement import.** CSV import of provider statements is not built; reconciliation is manual tick-off.
- **Legal confirmation.** **Q5**: whether EduKhata may hold customer funds until approval is still open.
