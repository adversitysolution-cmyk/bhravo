export type BillItem = {
  name: string;
  qty: number;
  unit?: string | null;
  price: number | null;
};

const KIND_LABEL: Record<string, string> = {
  bill: "Bill",
  receipt: "Receipt",
  quote: "Quote",
  note: "Note",
  trip: "Trip receipt",
};

function money(n: number): string {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * WhatsApp does not make upi:// links tappable, so we link to our own /pay
 * page, which opens the customer's UPI app.
 */
export function payLink(
  origin: string,
  upiId: string,
  payee: string,
  amount: number,
): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payee,
    am: String(amount),
  });
  return `${origin}/pay?${params.toString()}`;
}

/** wa.me wants digits with country code. Ten digits is assumed to be India. */
export function waLink(phone: string | null | undefined, text: string): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  const base = digits.length >= 11 ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function billMessage(args: {
  business: string;
  customer: string | null;
  kind: string;
  items: BillItem[];
  total: number;
  paid: boolean;
  payUrl: string | null;
}): string {
  const lines = args.items.map((i) => {
    const qty = `${i.qty}${i.unit ? ` ${i.unit}` : ""}`;
    const amount = i.price ? ` = ${money(i.qty * i.price)}` : "";
    return `• ${i.name} ${qty}${amount}`;
  });
  const parts = [
    `*${args.business}*`,
    `${KIND_LABEL[args.kind] ?? "Bill"}${args.customer ? ` for ${args.customer}` : ""}`,
    "",
    ...lines,
    "",
    `*Total: ${money(args.total)}* ${args.paid ? "(Paid ✅)" : "(Udhaar)"}`,
  ];
  if (!args.paid && args.payUrl) parts.push("", `Pay by UPI: ${args.payUrl}`);
  parts.push("", "Dhanyavaad 🙏");
  return parts.join("\n");
}

export type Tone = "gentle" | "firm";

export function reminderMessage(args: {
  business: string;
  customer: string;
  due: number;
  tone: Tone;
  english: boolean;
  payUrl: string | null;
}): string {
  const amount = money(args.due);
  let body: string;
  if (args.english) {
    body =
      args.tone === "gentle"
        ? `Hello ${args.customer}, a gentle reminder from ${args.business}: ${amount} is pending on your account. Please pay when convenient. Thank you!`
        : `Hello ${args.customer}, ${amount} is overdue at ${args.business}. Please pay today so we can clear your account.`;
  } else {
    body =
      args.tone === "gentle"
        ? `Namaste ${args.customer}, ${args.business} se yaad dila rahe hain: aapka ${amount} baaki hai. Jab convenient ho, kripya bhej dein. Dhanyavaad 🙏`
        : `Namaste ${args.customer}, ${args.business} mein aapka ${amount} ka bhugtaan pending hai. Kripya aaj hi bhej dein taaki hisaab clear ho jaye. Dhanyavaad.`;
  }
  return args.payUrl ? `${body}\n\nPay by UPI: ${args.payUrl}` : body;
}

export function spokenSummary(args: {
  customer: string | null;
  items: BillItem[];
  total: number;
  paid: boolean;
}): string {
  const things = args.items
    .map((i) => `${i.qty} ${i.unit ?? ""} ${i.name}`.replace(/\s+/g, " ").trim())
    .join(", ");
  return `${args.customer ? `${args.customer}. ` : ""}${things}. Total ${args.total} rupaye. ${args.paid ? "Paid." : "Udhaar."}`;
}
