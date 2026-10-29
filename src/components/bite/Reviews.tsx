import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Flag, MessageSquareReply, Pencil, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/lib/bite";
import { DISLIKE_TAGS, LIKE_TAGS, isLikeTag } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/bite/Busy";

export type Review = {
  id: string;
  restaurant_id: string;
  user_id: string;
  author_name: string;
  rating: number;
  body: string;
  tags: string[];
  photo_urls: string[];
  owner_reply: string | null;
  owner_replied_at: string | null;
  created_at: string;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

export function useReviews(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Review[];
    },
  });
}

export function ReviewsSection({
  restaurantId,
  restaurantName,
  isOwner,
}: {
  restaurantId: string;
  restaurantName: string;
  isOwner: boolean;
}) {
  const { user } = useAuth();
  const reviews = useReviews(restaurantId);
  const [writing, setWriting] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const qc = useQueryClient();

  const verified = useQuery({
    queryKey: ["can-review", restaurantId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { count } = await supabase
        .from("stamps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("restaurant_id", restaurantId);
      return (count ?? 0) > 0;
    },
  });

  const list = reviews.data ?? [];
  const mine = list.find((r) => r.user_id === user?.id) ?? null;
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of list) for (const t of r.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);
  const likes = tagCounts.filter(([t]) => isLikeTag(t)).slice(0, 4);
  const dislikes = tagCounts.filter(([t]) => !isLikeTag(t)).slice(0, 3);
  const photos = list.flatMap((r) => r.photo_urls.map((url) => ({ url, by: r.author_name })));
  const shown = showAll ? list : list.slice(0, 4);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["reviews", restaurantId] });
    qc.invalidateQueries({ queryKey: ["ratings"] });
    qc.invalidateQueries({ queryKey: ["owner-reviews"] });
  };

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-extrabold">Reviews</h2>
        {list.length > 0 && (
          <span className="flex items-center gap-1 text-lg font-extrabold">
            <Star className="size-5 fill-amber-400 text-amber-400" /> {avg.toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
          </span>
        )}
      </div>

      {(likes.length > 0 || dislikes.length > 0) && (
        <div className="mt-3 space-y-2 rounded-2xl bg-card p-4 shadow-card">
          {likes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                People love
              </span>
              {likes.map(([t, n]) => (
                <span
                  key={t}
                  className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success"
                >
                  {t} · {n}
                </span>
              ))}
            </div>
          )}
          {dislikes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Heads up
              </span>
              {dislikes.map(([t, n]) => (
                <span
                  key={t}
                  className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
                >
                  {t} · {n}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {photos.length > 0 && (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {photos.slice(0, 20).map((p, i) => (
            <button
              key={`${p.url}-${i}`}
              onClick={() => setPhoto(p.url)}
              className="shrink-0"
              aria-label={`Photo by ${p.by}`}
            >
              <img src={p.url} alt="" loading="lazy" className="size-24 rounded-2xl object-cover" />
            </button>
          ))}
        </div>
      )}

      {!isOwner && (
        <div className="mt-3">
          {!user ? (
            <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-card">
              <Link to="/auth" className="font-semibold text-primary">
                Sign in
              </Link>{" "}
              to leave a review.
            </p>
          ) : verified.data ? (
            <Button
              variant={mine ? "secondary" : "default"}
              size="xl"
              className="w-full"
              onClick={() => setWriting(true)}
            >
              {mine ? <Pencil className="size-5" /> : <Camera className="size-5" />}
              {mine ? "Edit my review" : "Write a review"}
            </Button>
          ) : verified.isSuccess ? (
            <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-card">
              ✅ Reviews on Bite are from real customers. Order, grab a drop, or scan the counter
              code here once and you can review.
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {reviews.isLoading && <div className="h-28 animate-pulse rounded-2xl bg-muted" />}
        {!reviews.isLoading && list.length === 0 && (
          <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
            No reviews yet. Be the first to tell Winnipeg about {restaurantName}.
          </p>
        )}
        {shown.map((r) => (
          <ReviewCard
            key={r.id}
            r={r}
            mine={r.user_id === user?.id}
            isOwner={isOwner}
            onPhoto={setPhoto}
            onChange={refresh}
          />
        ))}
        {list.length > 4 && !showAll && (
          <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
            Show all {list.length} reviews
          </Button>
        )}
      </div>

      {writing && user && (
        <ReviewSheet
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          userId={user.id}
          existing={mine}
          onClose={() => setWriting(false)}
          onSaved={() => {
            setWriting(false);
            refresh();
          }}
        />
      )}

      {photo && (
        <button
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4"
          onClick={() => setPhoto(null)}
          aria-label="Close photo"
        >
          <img src={photo} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        </button>
      )}
    </section>
  );
}

export function ReviewCard({
  r,
  mine,
  isOwner,
  onPhoto,
  onChange,
}: {
  r: Review;
  mine: boolean;
  isOwner: boolean;
  onPhoto: (url: string) => void;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.owner_reply ?? "");

  const report = async () => {
    if (!user) return;
    const reason = prompt("What's wrong with this review? (fake, offensive, spam…)");
    if (reason === null) return;
    const { error } = await supabase
      .from("review_reports")
      .insert({ review_id: r.id, reason: reason.slice(0, 300) });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else toast.success("Thanks, we'll take a look.");
  };
  const remove = async () => {
    if (!confirm("Delete your review?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    onChange();
  };
  const sendReply = async () => {
    const { error } = await supabase.rpc("reply_to_review", { p_review_id: r.id, p_reply: reply });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(reply.trim() ? "Reply posted" : "Reply removed");
    setReplying(false);
    onChange();
  };

  return (
    <article className="rounded-2xl bg-card p-4 shadow-card">
      <header className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-warm font-extrabold text-primary-foreground">
          {r.author_name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {r.author_name}
            {mine && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Stars value={r.rating} size="size-3.5" /> {fmtDate(r.created_at)} ·{" "}
            <span className="text-success">Verified visit</span>
          </p>
        </div>
        {mine ? (
          <button
            onClick={remove}
            aria-label="Delete review"
            className="grid size-9 place-items-center text-muted-foreground"
          >
            <Trash2 className="size-4" />
          </button>
        ) : user && !isOwner ? (
          <button
            onClick={report}
            aria-label="Report review"
            className="grid size-9 place-items-center text-muted-foreground"
          >
            <Flag className="size-4" />
          </button>
        ) : null}
      </header>
      {r.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.tags.map((t) => (
            <span
              key={t}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isLikeTag(t) ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}
            >
              {isLikeTag(t) ? "👍" : "👎"} {t}
            </span>
          ))}
        </div>
      )}
      {r.body && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{r.body}</p>}
      {r.photo_urls.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {r.photo_urls.map((u) => (
            <button key={u} onClick={() => onPhoto(u)} aria-label="Open photo">
              <img
                src={u}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {r.owner_reply && !replying && (
        <div className="mt-3 rounded-xl bg-secondary p-3 text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Reply from the owner
          </p>
          <p className="whitespace-pre-line">{r.owner_reply}</p>
        </div>
      )}
      {isOwner && !replying && (
        <Button
          variant="ghost"
          className="mt-2 h-10 px-2 text-primary"
          onClick={() => setReplying(true)}
        >
          <MessageSquareReply className="size-4" /> {r.owner_reply ? "Edit reply" : "Reply"}
        </Button>
      )}
      {isOwner && replying && (
        <div className="mt-3 space-y-2">
          <textarea
            value={reply}
            maxLength={600}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Thank them, or explain what you're fixing."
            className="min-h-20 w-full rounded-2xl border bg-background p-3 text-base outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <Button variant="ghost" className="h-10 flex-1" onClick={() => setReplying(false)}>
              Cancel
            </Button>
            <Button className="h-10 flex-1" onClick={sendReply}>
              Post reply
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function ReviewSheet({
  restaurantId,
  restaurantName,
  userId,
  existing,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  restaurantName: string;
  userId: string;
  existing: Review | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [body, setBody] = useState(existing?.body ?? "");
  const [photos, setPhotos] = useState<string[]>(existing?.photo_urls ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = (t: string) =>
    setTags((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= 8 ? cur : [...cur, t],
    );

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const room = 4 - photos.length;
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, room)) {
        if (f.size > 8 * 1024 * 1024) {
          toast.error(`${f.name} is over 8 MB`);
          continue;
        }
        urls.push(await uploadImage("review-photos", userId, f));
      }
      setPhotos((p) => [...p, ...urls].slice(0, 4));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!rating) {
      toast.error("Tap the stars to rate");
      return;
    }
    setSaving(true);
    const row = { rating, tags, body: body.trim(), photo_urls: photos };
    const { error } = existing
      ? await supabase.from("reviews").update(row).eq("id", existing.id)
      : await supabase.from("reviews").insert({ ...row, restaurant_id: restaurantId });
    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("row-level security")
          ? "Visit or order here first to review."
          : error.message,
      );
      return;
    }
    toast.success(existing ? "Review updated" : "Thanks for reviewing! 🍁");
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-[430px] space-y-4 overflow-y-auto rounded-t-3xl bg-card p-5 pb-safe animate-screen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{restaurantName}</h3>
          <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i} stars`}
              onClick={() => setRating(i)}
              className="p-1 active:scale-90"
            >
              <Star
                className={`size-10 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-border"}`}
              />
            </button>
          ))}
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">What did you like?</p>
          <div className="flex flex-wrap gap-2">
            {LIKE_TAGS.map((t) => (
              <TagButton key={t} on={tags.includes(t)} good onClick={() => toggle(t)}>
                {t}
              </TagButton>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">Anything you didn't like?</p>
          <div className="flex flex-wrap gap-2">
            {DISLIKE_TAGS.map((t) => (
              <TagButton key={t} on={tags.includes(t)} onClick={() => toggle(t)}>
                {t}
              </TagButton>
            ))}
          </div>
        </div>
        <textarea
          value={body}
          maxLength={1000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell people what you ordered and how it was."
          className="min-h-28 w-full rounded-2xl border bg-background p-4 text-base outline-none focus:border-primary"
        />
        <div className="grid grid-cols-4 gap-2">
          {photos.map((u) => (
            <div key={u} className="relative">
              <img src={u} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <button
                aria-label="Remove photo"
                onClick={() => setPhotos((p) => p.filter((x) => x !== u))}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < 4 && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed text-muted-foreground">
              <span className="flex flex-col items-center text-[11px] font-semibold">
                <Camera className="size-5" />
                {uploading ? "…" : "Add"}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addPhotos(e.target.files)}
              />
            </label>
          )}
        </div>
        <Button size="xl" className="w-full" disabled={saving || uploading} onClick={save}>
          {saving ? "Posting…" : existing ? "Save changes" : "Post review"}
        </Button>
      </div>
    </div>
  );
}

function TagButton({
  on,
  good,
  onClick,
  children,
}: {
  on: boolean;
  good?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = good
    ? "border-success bg-success/15 text-success"
    : "border-destructive bg-destructive/10 text-destructive";
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`h-9 rounded-full border px-3 text-sm font-semibold transition-all active:scale-95 ${on ? active : "border-border text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}
