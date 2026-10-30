import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, ExternalLink, FileText, MapPin, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Bite admin" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

const CHECKS = [
  "Find the restaurant on Google Maps. Does the name and address match?",
  "Call the phone number on Google Maps (not the one they typed). Ask for the person who applied.",
  "Do the documents match the business name and address?",
  "If they gave a business number, look it up in the Manitoba Companies Office registry.",
  "Is anyone else already verified for this restaurant on Bite?",
];

function Admin() {
  const qc = useQueryClient();
  const [show, setShow] = useState<"pending" | "all">("pending");
  const queue = useQuery({
    queryKey: ["verification-queue"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verification_queue");
      if (error) throw error;
      return data ?? [];
    },
  });
  const list = (queue.data ?? []).filter((v) => show === "all" || v.status === "pending");
  const pending = (queue.data ?? []).filter((v) => v.status === "pending").length;

  return (
    <div className="mx-auto max-w-[430px] px-5 pb-16 pt-[max(env(safe-area-inset-top),1.25rem)] animate-screen">
      <Link
        to="/profile"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">Business verification</h1>
      <p className="text-sm text-muted-foreground">
        {pending} waiting. Approve only when you're sure the person runs the restaurant.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
        {(["pending", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setShow(k)}
            className={`h-10 rounded-xl text-sm font-bold ${show === k ? "bg-card shadow-card" : "text-muted-foreground"}`}
          >
            {k === "pending" ? `Waiting (${pending})` : "All"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {queue.isLoading && <div className="h-60 animate-pulse rounded-3xl bg-secondary" />}
        {queue.error && (
          <p className="text-sm text-destructive">{(queue.error as Error).message}</p>
        )}
        {!queue.isLoading && list.length === 0 && (
          <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
            Nothing to review. 🎉
          </p>
        )}
        {list.map((v) => (
          <Application
            key={v.id}
            v={v}
            onDone={() => qc.invalidateQueries({ queryKey: ["verification-queue"] })}
          />
        ))}
      </div>
      <ListingReports />
    </div>
  );
}

function ListingReports() {
  const qc = useQueryClient();
  const reports = useQuery({
    queryKey: ["listing-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_listing_reports");
      if (error) throw error;
      return data ?? [];
    },
  });
  const resolve = async (id: string, hide: boolean) => {
    const { error } = await supabase.rpc("admin_resolve_listing", {
      p_restaurant_id: id,
      p_hide: hide,
    });
    if (error) return void toast.error(error.message);
    toast.success(hide ? "Listing hidden" : "Marked as fine");
    qc.invalidateQueries({ queryKey: ["listing-reports"] });
  };
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-extrabold">Listing reports</h2>
      <p className="text-sm text-muted-foreground">
        People telling us a spot closed or its details are wrong.
      </p>
      <div className="mt-3 space-y-3">
        {reports.data?.length === 0 && (
          <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
            No reports. 👍
          </p>
        )}
        {reports.data?.map((r) => (
          <article key={r.restaurant_id} className="rounded-3xl bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <Link to="/r/$slug" params={{ slug: r.restaurant_slug }} className="font-extrabold">
                {r.restaurant_name}
              </Link>
              <span className="shrink-0 text-xs font-bold text-muted-foreground">
                {r.reports} report{r.reports === 1 ? "" : "s"}
                {r.closed_reports ? ` · ${r.closed_reports} say closed` : ""}
              </span>
            </div>
            {r.notes.slice(0, 3).map((n, i) => (
              <p key={i} className="mt-2 rounded-xl bg-secondary p-2 text-sm">
                “{n}”
              </p>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="rounded-2xl shadow-none"
                onClick={() => resolve(r.restaurant_id, false)}
              >
                It's fine
              </Button>
              <Button
                variant="destructive"
                className="rounded-2xl"
                onClick={() => resolve(r.restaurant_id, true)}
              >
                Hide listing
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

type Row = Database["public"]["Functions"]["verification_queue"]["Returns"][number];

function Application({ v, onDone }: { v: Row; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false));
  const allChecked = checked.every(Boolean);
  const maps = `https://www.google.com/maps/search/${encodeURIComponent(`${v.restaurant_name} ${v.restaurant_address ?? ""} Winnipeg`)}`;

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("verification-docs")
      .createSignedUrl(path, 300);
    if (error || !data) return void toast.error("Couldn't open the file");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const review = async (approve: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("review_verification", {
      p_id: v.id,
      p_approve: approve,
      p_note: note,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(approve ? `${v.restaurant_name} is live` : "Sent back with your note");
    onDone();
  };

  const rows: [string, string | null][] = [
    ["Legal name", v.legal_name],
    ["Applicant", `${v.contact_name} (${v.contact_role})`],
    ["Account email", v.owner_email],
    ["Phone they gave", v.business_phone],
    ["Phone on their page", v.restaurant_phone],
    ["Business email", v.business_email],
    ["Website", v.website],
    ["Business number", v.business_number],
    ["Permit number", v.permit_number],
  ];

  return (
    <article className="rounded-3xl bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-extrabold">
            {v.restaurant_name}
            {v.kind === "claim" && (
              <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 align-middle text-[11px] font-bold text-primary">
                CLAIM
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">{v.restaurant_address ?? "No address"}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            v.status === "pending"
              ? "bg-amber-500/15 text-amber-600"
              : v.status === "approved"
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive"
          }`}
        >
          {v.status}
        </span>
      </div>
      <dl className="mt-3 divide-y text-sm">
        {rows
          .filter(([, val]) => val)
          .map(([k, val]) => (
            <div key={k} className="flex justify-between gap-3 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-semibold break-all">{val}</dd>
            </div>
          ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={maps}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-semibold"
        >
          <MapPin className="size-4" /> Google Maps
        </a>
        <a
          href={`tel:${v.business_phone}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-semibold"
        >
          <Phone className="size-4" /> Call
        </a>
        <Link
          to="/r/$slug"
          params={{ slug: v.restaurant_slug }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-semibold"
        >
          <ExternalLink className="size-4" /> Their page
        </Link>
        {v.doc_paths.map((p, i) => (
          <button
            key={p}
            onClick={() => openDoc(p)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-soft px-3 text-sm font-semibold text-primary"
          >
            <FileText className="size-4" /> Doc {i + 1}
          </button>
        ))}
      </div>

      {v.status === "pending" ? (
        <>
          <ul className="mt-4 space-y-2">
            {CHECKS.map((c, i) => (
              <li key={c}>
                <label className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                    checked={checked[i]}
                    onChange={(e) =>
                      setChecked((all) => all.map((x, j) => (j === i ? e.target.checked : x)))
                    }
                  />
                  {c}
                </label>
              </li>
            ))}
          </ul>
          <textarea
            className="mt-3 min-h-20 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="Note (required to reject; the owner sees it)"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="rounded-2xl shadow-none"
              disabled={busy}
              onClick={() => review(false)}
            >
              <X className="size-4" /> Reject
            </Button>
            <Button
              className="rounded-2xl"
              disabled={busy || !allChecked}
              onClick={() => review(true)}
            >
              <Check className="size-4" /> Approve
            </Button>
          </div>
          {!allChecked && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Tick every check to approve.
            </p>
          )}
        </>
      ) : (
        v.admin_note && (
          <p className="mt-3 rounded-2xl bg-secondary p-3 text-sm">Note: {v.admin_note}</p>
        )
      )}
    </article>
  );
}
