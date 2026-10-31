"use client";

import { useEffect, useState } from "react";

type Pay = { pa: string; pn: string; am: string };

const UPI_PATTERN = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/;

export default function PayPage() {
  const [pay, setPay] = useState<Pay | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pa = q.get("pa") ?? "";
    const pn = (q.get("pn") ?? "").slice(0, 60);
    const am = q.get("am") ?? "";
    const valid = UPI_PATTERN.test(pa) && Number(am) > 0 && Number(am) < 1e7;
    setPay(valid ? { pa, pn, am } : null);
  }, []);

  if (pay === undefined) {
    return <div className="flex flex-1 items-center justify-center text-muted">Loading...</div>;
  }

  if (pay === null) {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 text-center">
        <h1 className="font-serif text-3xl">This pay link is not valid</h1>
        <p className="mt-2 text-muted">Ask the shop to send the bill again.</p>
      </div>
    );
  }

  const upi =
    `upi://pay?pa=${encodeURIComponent(pay.pa)}` +
    `&pn=${encodeURIComponent(pay.pn)}` +
    `&am=${encodeURIComponent(pay.am)}&cu=INR&tn=${encodeURIComponent("Bill payment")}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(pay!.pa);
      setCopied(true);
    } catch {
      /* clipboard can be blocked; the ID is shown on screen anyway */
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12 text-center">
      <p className="font-serif text-xl font-semibold text-leaf">Bhravo</p>
      <p className="mt-8 text-sm text-muted">You are paying</p>
      <h1 className="font-serif text-3xl">{pay.pn || pay.pa}</h1>
      <p className="mt-4 font-serif text-6xl">₹{Number(pay.am).toLocaleString("en-IN")}</p>

      <a
        href={upi}
        className="mt-8 rounded-full bg-saffron px-8 py-4 text-lg font-medium text-white shadow hover:opacity-90"
      >
        Pay with UPI app
      </a>

      <p className="mt-6 text-sm text-muted">
        Or pay manually to <span className="font-medium text-foreground">{pay.pa}</span>
      </p>
      <button onClick={copy} className="mt-2 text-sm font-medium text-leaf underline">
        {copied ? "Copied" : "Copy UPI ID"}
      </button>
      <p className="mt-8 text-xs text-muted">
        Check the name and amount above before you pay. The button works on a phone with a UPI app.
      </p>
    </div>
  );
}
