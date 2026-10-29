"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Clock, ImageUp, ShieldCheck } from "lucide-react";
import {
  fixtures,
  formatMoney,
  isValidTrxId,
  normalizeBdMobile,
  normalizeTrxId,
  type Payment,
  type PaymentOption,
} from "@edukhata/contracts";
import { Button, Card, Field } from "@/components/ui";
import { CopyButton, useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { orderApi } from "@/lib/order-api";
import { METHOD_LABEL, PaymentStatusBadge } from "./PaymentsTable";

/**
 * Manual "send money + transaction ID" flow, following ICTSpark's workflow
 * (docs/PAYMENT_AND_COMMISSION.md) with EduKhata's fixes: login + ownership,
 * DB-unique TrxID, optional proof upload, accountant verification.
 */
export function ManualPayment({
  payment,
  backHref,
  options: liveOptions,
}: {
  payment: Payment;
  backHref: string;
  /** Live: EduKhata's receiving accounts (GET /api/payments/accounts); submits to the API. */
  options?: PaymentOption[];
}) {
  const { lang } = useT();
  const toast = useToast();
  const live = !!liveOptions;
  const options = liveOptions ?? fixtures.paymentOptions;
  const [key, setKey] = useState(options[0]?.key ?? "");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sender, setSender] = useState("");
  const [trx, setTrx] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(payment.status === "submitted");
  const opt = options.find((o) => o.key === key);
  const usedTrx = new Set(
    live ? [] : fixtures.payments.filter((p) => p.id !== payment.id && p.trxId).map((p) => p.trxId),
  );
  if (!opt)
    return (
      <Card className="mx-auto max-w-xl p-8 text-center text-sm text-muted">
        No payment account is set up yet. Please contact EduKhata support.
      </Card>
    );

  if (submitted) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <Clock size={44} className="mx-auto text-violet-600" />
        <h2 className="mt-3 text-xl font-extrabold">Payment submitted for verification</h2>
        <p className="mt-2 text-sm text-muted">
          Our accounts team matches your transaction ID with the {opt.name} statement — usually
          within a few hours. You&apos;ll get a notification, and matching starts right after
          approval.
        </p>
        <div className="mt-4 flex justify-center">
          <PaymentStatusBadge status="submitted" />
        </div>
        <Link
          href={backHref}
          className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-[var(--color-accent)] px-5 text-sm font-semibold text-white"
        >
          {live ? "Back to the order" : "Back to payments"}
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="p-5 sm:p-6">
        {payment.status === "rejected" && (
          <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-danger">
            Previous submission was rejected: {payment.note}. Check the transaction ID and submit
            again.
          </p>
        )}
        <fieldset>
          <legend className="mb-2 text-sm font-bold">1. Choose how you paid</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {options.map((o) => (
              <label
                key={o.key}
                className={cn(
                  "cursor-pointer rounded-xl border p-3 text-center text-sm font-semibold",
                  key === o.key
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-50)]"
                    : "border-line",
                )}
              >
                <input
                  type="radio"
                  name="method"
                  className="sr-only"
                  checked={key === o.key}
                  onChange={() => (setKey(o.key), setErrors({}))}
                />
                {o.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-bold">2. Send exactly {formatMoney(payment.amount, lang)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-bold">{opt.number}</span>
            <CopyButton text={opt.number} />
            <span className="text-xs text-muted">
              ({opt.channel === "bank" ? "bank account" : `${opt.name} ${opt.channel}`})
            </span>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {opt.instructions.map((s) => (
              <li key={s}>{s}</li>
            ))}
            <li>
              Reference: <b>{payment.orderCode}</b>
            </li>
          </ol>
          {!live && (
            <p className="mt-2 text-[11px] text-muted">
              Account numbers are configured by the super admin (shown masked in this preview).
            </p>
          )}
        </div>
        <form
          noValidate
          className="mt-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const er: Record<string, string> = {};
            if (opt.method === "bank") {
              if (sender.trim().length < 3)
                er.sender = "Enter the account name / bank you paid from";
            } else if (!normalizeBdMobile(sender))
              er.sender = "Enter the number you sent from (01XXXXXXXXX)";
            if (!isValidTrxId(trx, opt.method))
              er.trx =
                opt.method === "bank"
                  ? "Enter the bank reference (4–30 letters/numbers)"
                  : "Enter the TrxID exactly as in the SMS (6–20 letters/numbers)";
            else if (usedTrx.has(normalizeTrxId(trx)))
              er.trx = "This transaction ID was already used for another payment";
            setErrors(er);
            if (Object.keys(er).length) return;
            if (live) {
              setBusy(true);
              try {
                let proofKey: string | undefined;
                if (proofFile) {
                  const p = await orderApi<{
                    proofKey: string;
                    uploadUrl: string;
                    headers: Record<string, string>;
                  }>(`/payments/${payment.id}/proof`, "POST", {
                    contentType: proofFile.type,
                    byteSize: proofFile.size,
                  });
                  const put = await fetch(p.uploadUrl, {
                    method: "PUT",
                    headers: p.headers,
                    body: proofFile,
                  });
                  if (!put.ok) throw new Error("The screenshot could not be uploaded");
                  proofKey = p.proofKey;
                }
                await orderApi(`/payments/${payment.id}/submit`, "POST", {
                  accountId: opt.key,
                  sender,
                  trxId: trx,
                  ...(proofKey ? { proofKey } : {}),
                });
                setSubmitted(true);
                toast({ tone: "success", title: "Submitted for verification" });
              } catch (err) {
                setErrors({ trx: (err as Error).message });
              } finally {
                setBusy(false);
              }
              return;
            }
            setSubmitted(true);
            toast({
              tone: "success",
              title: "Submitted for verification",
              body: "Demo only — not saved.",
            });
          }}
        >
          <p className="text-sm font-bold">3. Tell us about the transfer</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={opt.method === "bank" ? "Paid from (name / bank)" : "Sender number"}
              required
              htmlFor="snd"
              error={errors.sender}
            >
              <input
                id="snd"
                className="input"
                inputMode={opt.method === "bank" ? "text" : "tel"}
                aria-invalid={!!errors.sender}
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              />
            </Field>
            <Field
              label={opt.method === "bank" ? "Bank reference no." : "Transaction ID (TrxID)"}
              required
              htmlFor="trx"
              error={errors.trx}
              hint="Bengali digits are accepted"
            >
              <input
                id="trx"
                className="input font-mono uppercase"
                aria-invalid={!!errors.trx}
                value={trx}
                onChange={(e) => setTrx(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line p-3 text-sm">
            <ImageUp size={20} className="text-muted" />
            <span className="flex-1">
              <span className="block font-medium">Payment screenshot (optional)</span>
              <span className="text-[11px] text-muted">
                {proof ?? "JPG/PNG/PDF, max 5 MB — helps faster verification"}
              </span>
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="sr-only"
              onChange={(e) => (
                setProof(e.target.files?.[0]?.name ?? null),
                setProofFile(e.target.files?.[0] ?? null)
              )}
            />
          </label>
          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full sm:w-auto"
            disabled={busy}
          >
            Submit for verification
          </Button>
        </form>
      </Card>
      <aside className="space-y-4">
        <Card className="p-5">
          <p className="text-xs text-muted">Invoice {payment.invoiceNo}</p>
          <p className="mt-1 text-sm font-semibold">Order {payment.orderCode}</p>
          <p className="mt-3 text-3xl font-extrabold">{formatMoney(payment.amount, lang)}</p>
          <div className="mt-2">
            <PaymentStatusBadge status={payment.status} />
          </div>
        </Card>
        <Card className="space-y-2 p-5 text-sm text-slate-700">
          <p className="flex gap-2">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" /> The mentor is paid
            only after you approve the work.
          </p>
          <p className="flex gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> Each transaction ID
            can be used once.
          </p>
          <p className="flex gap-2">
            <Clock size={16} className="mt-0.5 shrink-0 text-muted" /> Online gateways (
            {Object.values(METHOD_LABEL).slice(0, 2).join(", ")}, SSLCommerz) will be added when
            merchant accounts are ready.
          </p>
        </Card>
      </aside>
    </div>
  );
}
