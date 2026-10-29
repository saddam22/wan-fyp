"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Field } from "@/components/ui";
import { useDemoToast, useToast } from "@/components/ui/client";

/** `live`: sent to EduKhata's inbox (admins); demo: a toast only. */
export function ContactForm({ live }: { live?: boolean } = {}) {
  const toast = useToast();
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", contact: "", topic: "order", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const demo = useDemoToast();
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const er: Record<string, string> = {};
        if (f.name.trim().length < 2) er.name = "Enter your name";
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact) &&
          !/^(\+?880|0)1[3-9]\d{8}$/.test(f.contact.replace(/[\s-]/g, ""))
        )
          er.contact = "Enter an email or a Bangladeshi mobile number";
        if (f.message.trim().length < 10) er.message = "Write at least 10 characters";
        setErrors(er);
        if (Object.keys(er).length) return;
        if (live) {
          setBusy(true);
          const res = await fetch("/api/contact", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...f, website }),
          }).catch(() => null);
          setBusy(false);
          if (!res?.ok) {
            const msg = (await res?.json().catch(() => null))?.error?.message;
            return setErrors({ message: msg ?? "Couldn't send — please try again" });
          }
          setF({ name: "", contact: "", topic: "order", message: "" });
          return toast({
            tone: "success",
            title: "Message sent",
            body: "The EduKhata team will reply by email or phone.",
          });
        }
        setF({ name: "", contact: "", topic: "order", message: "" });
        demo("Message sent to support");
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required htmlFor="c-name" error={errors.name}>
          <input
            id="c-name"
            className="input"
            aria-invalid={!!errors.name}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Field>
        <Field label="Email or mobile" required htmlFor="c-contact" error={errors.contact}>
          <input
            id="c-contact"
            className="input"
            aria-invalid={!!errors.contact}
            value={f.contact}
            onChange={(e) => setF({ ...f, contact: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Topic" htmlFor="c-topic">
        <select
          id="c-topic"
          className="input"
          value={f.topic}
          onChange={(e) => setF({ ...f, topic: e.target.value })}
        >
          <option value="order">An order</option>
          <option value="payment">A payment</option>
          <option value="mentor">Becoming a mentor</option>
          <option value="copyright">Copyright / content complaint</option>
          <option value="institution">Institution / academic-integrity report</option>
          <option value="other">Something else</option>
        </select>
      </Field>
      <Field label="Message" required htmlFor="c-msg" error={errors.message}>
        <textarea
          id="c-msg"
          rows={5}
          className="input"
          aria-invalid={!!errors.message}
          value={f.message}
          onChange={(e) => setF({ ...f, message: e.target.value })}
          maxLength={2000}
        />
      </Field>
      {/* Left empty by people; bots fill it. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      <button
        disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand"
      >
        <Send size={16} /> Send message
      </button>
    </form>
  );
}
