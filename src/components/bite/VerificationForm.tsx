import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const field =
  "h-12 w-full rounded-2xl border bg-card px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";
const MAX_MB = 10;

const DOC_IDEAS = [
  "City of Winnipeg food service permit (photo of the one on your wall is fine)",
  "Manitoba business registration or CRA business number letter",
  "A recent utility bill or lease for the restaurant address",
  "A photo of you inside the restaurant holding a paper with “Bite” and today's date",
];

type Doc = { path: string; name: string };

/** Proof-of-business form, used both to verify a new page and to claim an existing listing. */
export function VerificationForm({
  userId,
  restaurant,
  title,
  intro,
  onDone,
}: {
  userId: string;
  restaurant: { id: string; name: string; phone: string | null };
  title: string;
  intro: string;
  onDone: () => void | Promise<void>;
}) {
  const r = restaurant;
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    legal_name: "",
    contact_name: "",
    contact_role: "owner",
    business_phone: "",
    business_email: "",
    website: "",
    business_number: "",
    permit_number: "",
  });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    setF((p) => ({
      ...p,
      legal_name: p.legal_name || r.name,
      business_phone: p.business_phone || (r.phone ?? ""),
    }));
  }, [r]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = 5 - docs.length;
    const list = Array.from(files).slice(0, room);
    setUploading(true);
    try {
      for (const file of list) {
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(`${file.name} is over ${MAX_MB} MB`);
          continue;
        }
        if (!/^image\/|^application\/pdf$/.test(file.type)) {
          toast.error(`${file.name}: use a photo or PDF`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("verification-docs")
          .upload(path, file, { contentType: file.type });
        if (error) throw error;
        setDocs((d) => [...d, { path, name: file.name }]);
      }
    } catch {
      toast.error("Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docs.length) return void toast.error("Add at least one document");
    if (!agree) return void toast.error("Please confirm you run this business");
    setBusy(true);
    const { error } = await supabase.rpc("submit_verification", {
      p_restaurant_id: r.id,
      p_legal_name: f.legal_name,
      p_contact_name: f.contact_name,
      p_contact_role: f.contact_role,
      p_business_phone: f.business_phone,
      p_business_email: f.business_email,
      p_website: f.website,
      p_business_number: f.business_number,
      p_permit_number: f.permit_number,
      p_doc_paths: docs.map((d) => d.path),
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Sent! We'll be in touch within 1 to 2 business days.");
    await onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4 px-5 pt-5 animate-screen">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      </div>

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card">
        <h2 className="font-bold">About the business</h2>
        <input
          className={field}
          placeholder="Legal business name"
          required
          minLength={2}
          maxLength={120}
          value={f.legal_name}
          onChange={set("legal_name")}
        />
        <input
          className={field}
          placeholder="Business phone (the one customers call)"
          type="tel"
          required
          minLength={7}
          maxLength={25}
          value={f.business_phone}
          onChange={set("business_phone")}
        />
        <input
          className={field}
          placeholder="Website or Instagram (optional)"
          maxLength={200}
          value={f.website}
          onChange={set("website")}
        />
        <input
          className={field}
          placeholder="Business email (optional)"
          type="email"
          maxLength={120}
          value={f.business_email}
          onChange={set("business_email")}
        />
        <input
          className={field}
          placeholder="Business number (optional)"
          maxLength={40}
          value={f.business_number}
          onChange={set("business_number")}
        />
        <input
          className={field}
          placeholder="Food service permit number (optional)"
          maxLength={40}
          value={f.permit_number}
          onChange={set("permit_number")}
        />
      </section>

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card">
        <h2 className="font-bold">About you</h2>
        <input
          className={field}
          placeholder="Your full name"
          required
          minLength={2}
          maxLength={80}
          value={f.contact_name}
          onChange={set("contact_name")}
        />
        <select className={field} value={f.contact_role} onChange={set("contact_role")}>
          <option value="owner">I'm the owner</option>
          <option value="manager">I'm a manager</option>
          <option value="other">Other staff (owner said OK)</option>
        </select>
      </section>

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card">
        <h2 className="font-bold">Proof (1 to 5 files)</h2>
        <p className="text-sm text-muted-foreground">
          Any one of these works. Photos or PDFs, up to {MAX_MB} MB each:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {DOC_IDEAS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        {docs.map((d) => (
          <div
            key={d.path}
            className="flex items-center gap-3 rounded-2xl bg-secondary px-3 py-2.5"
          >
            <FileText className="size-5 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{d.name}</span>
            <button
              type="button"
              aria-label={`Remove ${d.name}`}
              onClick={() => setDocs((all) => all.filter((x) => x.path !== d.path))}
              className="grid size-8 place-items-center rounded-full"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        {docs.length < 5 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full rounded-2xl border-dashed shadow-none"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" /> {uploading ? "Uploading…" : "Add a photo or PDF"}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </section>

      <div className="rounded-3xl bg-primary-soft p-4 text-sm">
        <p className="font-bold text-primary">How we check</p>
        <p className="mt-1">
          We look up your restaurant on Google Maps and call that number (not just the one you
          typed) to confirm you work there. Then your page goes live and your 3 free months start.
        </p>
      </div>

      <label className="flex items-start gap-3 px-1 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5 accent-[var(--primary)]"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
        />
        <span>I own or manage this restaurant and I'm allowed to list it on Bite.</span>
      </label>

      <Button type="submit" size="xl" className="w-full" disabled={busy || uploading}>
        {busy ? "Sending…" : "Submit for review"}
      </Button>
    </form>
  );
}
