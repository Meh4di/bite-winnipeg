import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyRestaurant } from "./owner";

export const Route = createFileRoute("/owner/kit")({
  head: () => ({ meta: [{ title: "Counter sign — Bity Business" }] }),
  component: Kit,
});

const SIZES = [
  { key: "table", label: "Table tent", note: "Fits a 4×6 stand" },
  { key: "window", label: "Window / wall", note: "Full letter page" },
] as const;

/** A printable "Find us on Bity" sign: QR to the restaurant's Bity page. */
function Kit() {
  const { data: r } = useMyRestaurant();
  const [qr, setQr] = useState<string | null>(null);
  const [size, setSize] = useState<(typeof SIZES)[number]["key"]>("window");
  const url = r ? `${window.location.origin}/r/${r.slug}` : null;

  useEffect(() => {
    if (!url) return;
    let alive = true;
    QRCode.toDataURL(url, {
      width: 900,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1f1414", light: "#ffffff" },
    })
      .then((d) => alive && setQr(d))
      .catch(() => setQr(null));
    return () => {
      alive = false;
    };
  }, [url]);

  if (!r) return <div className="m-5 h-96 animate-pulse rounded-3xl bg-muted" />;

  const big = size === "window";
  return (
    <div className="px-5 pb-10 pt-5 print:p-0">
      <div className="print:hidden">
        <h1 className="text-2xl font-extrabold">Your counter sign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customers scan it to follow you, see your deals and order ahead. Print it and put it by
          the register, on tables or in the window.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {SIZES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSize(s.key)}
              className={`rounded-2xl p-3 text-left ${size === s.key ? "bg-foreground text-background" : "bg-card shadow-card"}`}
            >
              <span className="block font-bold">{s.label}</span>
              <span className="block text-xs opacity-75">{s.note}</span>
            </button>
          ))}
        </div>
        <Button onClick={() => window.print()} size="xl" className="mt-4 w-full">
          <Printer className="size-5" /> Print sign
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Tip: print it in colour at any print shop, or on your own printer.
        </p>
        <p className="mb-3 mt-6 text-sm font-bold">Preview</p>
      </div>

      <article
        className={`mx-auto flex flex-col items-center rounded-[2rem] border-[6px] border-primary bg-white text-center text-stone-900 shadow-pop print:rounded-none print:border-[10px] print:shadow-none ${big ? "max-w-[420px] p-8 print:max-w-none print:p-16" : "max-w-[300px] p-6 print:max-w-[4in] print:p-8"}`}
      >
        <div className="flex items-center gap-2">
          <img
            src="/icons/icon-192.png"
            alt=""
            className={big ? "size-12 rounded-xl" : "size-9 rounded-lg"}
          />
          <span className={`font-display font-extrabold ${big ? "text-4xl" : "text-3xl"}`}>
            bity
          </span>
        </div>
        <p
          className={`mt-4 font-extrabold leading-tight ${big ? "text-3xl print:text-5xl" : "text-2xl"}`}
        >
          Find us on Bity
        </p>
        <p
          className={`mt-1 font-semibold text-stone-600 ${big ? "text-lg print:text-2xl" : "text-sm"}`}
        >
          {r.name}
        </p>
        {qr ? (
          <img
            src={qr}
            alt={`QR code for ${r.name} on Bity`}
            className={`mt-5 ${big ? "w-64 print:w-[4.5in]" : "w-44 print:w-[2.6in]"}`}
          />
        ) : (
          <div
            className={`mt-5 animate-pulse rounded-xl bg-stone-200 ${big ? "size-64" : "size-44"}`}
          />
        )}
        <p className={`mt-4 font-bold ${big ? "text-base print:text-2xl" : "text-xs"}`}>
          Scan for our deals · order ahead · collect stamps
        </p>
        <p
          className={`mt-3 rounded-full bg-primary px-4 py-1.5 font-extrabold text-white ${big ? "text-sm print:text-xl" : "text-[11px]"}`}
        >
          🍁 Winnipeg's local food app
        </p>
      </article>
    </div>
  );
}
