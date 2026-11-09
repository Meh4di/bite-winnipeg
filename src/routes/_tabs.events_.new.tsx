import { Suspense, lazy, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ImagePick } from "@/components/bite/ImagePick";
import { isVerified } from "@/components/bite/Verification";
import { EVENT_CATEGORIES, EVENT_TAGS, type EventCategory } from "@/lib/events";

const PinPicker = lazy(() => import("@/components/bite/PinPicker"));

export const Route = createFileRoute("/_tabs/events_/new")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: "/events/new" } });
  },
  head: () => ({ meta: [{ title: "Post an event — Bity" }] }),
  component: NewEvent,
});

const field = "h-12 w-full rounded-2xl border bg-card px-3.5 text-[15px]";
const pad = (n: number) => String(n).padStart(2, "0");
const tomorrow = () => {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function NewEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: "",
    category: "" as EventCategory | "",
    date: tomorrow(),
    start: "18:00",
    end: "21:00",
    venue: "",
    address: "",
    lat: null as number | null,
    lng: null as number | null,
    photo: null as string | null,
    free: false,
    price: "",
    link: "",
    tags: [] as string[],
    description: "",
    asRestaurant: true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const mine = useQuery({
    queryKey: ["my-restaurant-lite", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name, verification_status, address, lat, lng")
        .eq("owner_id", user!.id)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const r = mine.data;
  const postingAsBusiness = !!r && f.asRestaurant;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!f.category) return void toast.error("Pick what kind of event it is");
    const starts = new Date(`${f.date}T${f.start}`);
    let ends = new Date(`${f.date}T${f.end}`);
    if (ends <= starts) ends = new Date(ends.getTime() + 86_400_000); // ends after midnight
    if (starts.getTime() < Date.now() - 3600_000)
      return void toast.error("That start time has passed");
    if (f.link && !/^https:\/\//i.test(f.link.trim()))
      return void toast.error("Links need to start with https://");
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_event", {
      p_title: f.title,
      p_description: f.description || null,
      p_category: f.category,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_venue_name: f.venue,
      p_address: f.address || null,
      p_lat: f.lat,
      p_lng: f.lng,
      p_photo_url: f.photo,
      p_is_free: f.free,
      p_price_text: f.free ? null : f.price || null,
      p_link_url: f.link.trim() || null,
      p_tags: f.tags,
      ...(postingAsBusiness ? { p_restaurant_id: r.id } : {}),
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    const row = data?.[0];
    toast.success(
      row?.status === "approved"
        ? "Your event is live 🎉"
        : "Thanks! Bity will review it shortly, usually within a day.",
    );
    await qc.invalidateQueries({ queryKey: ["events"] });
    if (row) navigate({ to: "/events/$id", params: { id: row.id } });
  };

  return (
    <form
      onSubmit={submit}
      className="animate-screen space-y-4 px-5 pb-10 pt-[max(env(safe-area-inset-top),1.25rem)]"
    >
      <header className="flex items-center gap-3">
        <Link
          to="/events"
          className="grid size-10 place-items-center rounded-full bg-card shadow-card"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-extrabold">Post an event</h1>
      </header>

      {r && (
        <label className="flex items-start gap-3 rounded-3xl bg-[#1C1917] p-4 text-white">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={f.asRestaurant}
            onChange={(e) => set("asRestaurant", e.target.checked)}
          />
          <span>
            <span className="block font-bold">Post as {r.name}</span>
            <span className="block text-sm opacity-80">
              {isVerified(r)
                ? "Verified businesses go live right away."
                : "Goes live after your business is verified, or after Bity reviews it."}
            </span>
          </span>
        </label>
      )}
      {!postingAsBusiness && (
        <p className="rounded-2xl bg-primary-soft px-3 py-2 text-sm">
          Community events are checked by Bity before they go live, to keep out spam and fake
          events. Public events only, please.
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-bold">What kind of event?</p>
        <div className="flex flex-wrap gap-2">
          {EVENT_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              onClick={() => set("category", c.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold ${f.category === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      <input
        className={field}
        required
        minLength={3}
        maxLength={90}
        placeholder="Event name, e.g. Winter night market"
        value={f.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <ImagePick
        bucket="event-photos"
        userId={user?.id ?? ""}
        value={f.photo}
        onChange={(url) => set("photo", url)}
        label="Add a photo or poster (optional)"
        className="h-40 w-full"
      />

      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-3 text-sm font-semibold">
          Date
          <input
            type="date"
            className={`${field} mt-1`}
            required
            value={f.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </label>
        <label className="col-span-3 grid grid-cols-2 gap-2 text-sm font-semibold sm:col-span-3">
          <span>
            Starts
            <input
              type="time"
              className={`${field} mt-1`}
              required
              value={f.start}
              onChange={(e) => set("start", e.target.value)}
            />
          </span>
          <span>
            Ends
            <input
              type="time"
              className={`${field} mt-1`}
              required
              value={f.end}
              onChange={(e) => set("end", e.target.value)}
            />
          </span>
        </label>
      </div>

      <input
        className={field}
        required
        minLength={2}
        maxLength={90}
        placeholder="Venue, e.g. The Forks, Canada Life Centre"
        value={f.venue}
        onChange={(e) => set("venue", e.target.value)}
      />
      <input
        className={field}
        maxLength={160}
        placeholder="Street address"
        value={f.address}
        onChange={(e) => set("address", e.target.value)}
      />
      <Suspense fallback={<div className="h-60 animate-pulse rounded-2xl bg-muted" />}>
        <PinPicker
          address={f.address || f.venue}
          lat={f.lat}
          lng={f.lng}
          onChange={(lat, lng) => setF((p) => ({ ...p, lat, lng }))}
        />
      </Suspense>
      <p className="-mt-2 text-xs text-muted-foreground">
        Place the pin so it shows on the Bity map and people see food spots nearby.
      </p>

      <div className="rounded-3xl bg-card p-4 shadow-card">
        <label className="flex items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-5"
            checked={f.free}
            onChange={(e) => set("free", e.target.checked)}
          />
          Free to attend
        </label>
        {!f.free && (
          <input
            className={`${field} mt-3`}
            maxLength={40}
            placeholder="Price, e.g. $15, $10–25, Pay what you can"
            value={f.price}
            onChange={(e) => set("price", e.target.value)}
          />
        )}
      </div>

      <input
        className={field}
        inputMode="url"
        placeholder="Tickets or info link (https://…), optional"
        value={f.link}
        onChange={(e) => set("link", e.target.value)}
      />

      <div>
        <p className="mb-2 text-sm font-bold">Good to know</p>
        <div className="flex flex-wrap gap-2">
          {EVENT_TAGS.map((t) => {
            const on = f.tags.includes(t.key);
            return (
              <button
                type="button"
                key={t.key}
                onClick={() =>
                  set("tags", on ? f.tags.filter((x) => x !== t.key) : [...f.tags, t.key])
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${on ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        className="min-h-28 w-full rounded-2xl border bg-card p-3.5 text-[15px]"
        maxLength={1500}
        placeholder="What should people know? Food, music, what to bring…"
        value={f.description}
        onChange={(e) => set("description", e.target.value)}
      />

      <Button type="submit" disabled={busy} size="xl" className="w-full">
        {busy ? "Posting…" : postingAsBusiness && isVerified(r) ? "Post event" : "Send for review"}
      </Button>
    </form>
  );
}
