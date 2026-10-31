import Link from "next/link";

const trades = [
  { name: "Shopkeeper", line: "Bills and udhaar by voice" },
  { name: "Doctor", line: "Visit notes and fee receipts" },
  { name: "Tailor", line: "Orders, measurements, delivery dates" },
  { name: "Teacher", line: "Fee tracker and parent messages" },
  { name: "Driver", line: "Trip log and daily earnings" },
  { name: "Painter", line: "Quotes with a UPI advance link" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-4xl items-center justify-between rounded-full border border-line bg-white/70 px-5 py-3 backdrop-blur">
        <span className="font-serif text-xl font-semibold text-leaf">Bhravo</span>
        <div className="flex items-center gap-3 text-sm font-medium">
          <Link href="/login" className="px-3 py-1.5 hover:text-saffron">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-leaf px-4 py-2 text-white hover:opacity-90"
          >
            Start free
          </Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6">
        <section className="py-20 text-center sm:py-28">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Voice billing for Indian businesses
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-[1.05] sm:text-7xl">
            Bolo.
            <br />
            <span className="italic text-saffron">Bill ready.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Speak in Hindi, English or a mix. Bhravo writes the bill, tracks the
            khata, and sends it on WhatsApp with a UPI link.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/signup"
              className="rounded-full bg-saffron px-7 py-3.5 text-base font-medium text-white shadow hover:opacity-90"
            >
              Start free
            </Link>
          </div>

          <div className="mx-auto mt-14 grid max-w-2xl gap-4 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                You say
              </p>
              <p className="mt-2">
                Sharma ji ko do kilo chawal, ek kilo dal, udhaar mein likh do
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-leaf-soft p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-leaf">
                Bhravo writes
              </p>
              <p className="mt-2 text-sm">
                Sharma ji: Chawal 2 kg, Dal 1 kg. Added to khata. Bill ready
                to send.
              </p>
            </div>
          </div>
        </section>

        <section className="pb-24">
          <h2 className="text-center font-serif text-3xl sm:text-4xl">
            One voice, <span className="italic">many businesses</span>
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trades.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-line bg-white p-5"
              >
                <h3 className="font-serif text-xl">{t.name}</h3>
                <p className="mt-1 text-sm text-muted">{t.line}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-sm text-muted">
        Bhravo. Built by voice.
      </footer>
    </div>
  );
}
