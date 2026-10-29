"use client";

import { useState } from "react";
import { useDemoToast } from "@/components/ui/client";

export function NewsletterForm({ placeholder, label }: { placeholder: string; label: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const demo = useDemoToast();
  return (
    <form
      noValidate
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
          return setError("Enter a valid email address");
        setError("");
        setEmail("");
        demo("Subscribed to the newsletter");
      }}
    >
      <div className="flex overflow-hidden rounded-lg bg-white">
        <label className="flex-1">
          <span className="sr-only">{placeholder}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            aria-invalid={!!error}
            className="w-full px-3 py-2 text-sm text-ink outline-none"
          />
        </label>
        <button className="bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand">
          {label}
        </button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </form>
  );
}
