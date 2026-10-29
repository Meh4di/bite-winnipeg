import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Ban, Flag, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FollowButton, PersonAvatar } from "@/components/bite/Social";
import {
  feedLine,
  firstName,
  matchTone,
  timeAgo,
  useBadges,
  usePeople,
  useSpots,
} from "@/lib/social";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_tabs/people/$id")({
  head: () => ({
    meta: [
      { title: "Foodie — Bite" },
      { name: "description", content: "A foodie on Bite, Winnipeg's food app." },
    ],
  }),
  component: PersonPage,
});

const REASONS = [
  "Made me feel unsafe",
  "Harassment or hate",
  "Didn't show up / no-show host",
  "Fake profile or spam",
  "Under 18",
  "Something else",
];

function PersonPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const me = user?.id;
  const valid = UUID.test(id);

  const people = usePeople(valid ? [id] : []);
  const person = people.data?.get(id);
  const summary = useQuery({
    queryKey: ["social-summary", id, me],
    enabled: valid && !!me,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("social_summary", { p_user: id });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const match = useQuery({
    queryKey: ["taste-match", id, me],
    enabled: valid && !!me && me !== id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("taste_match", { p_other: id });
      if (error) throw error;
      return data as number | null;
    },
  });
  const activity = useQuery({
    queryKey: ["person-activity", id, me],
    enabled: valid && !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity")
        .select("id, kind, restaurant_id, badge_id, rating, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
  const spots = useSpots();
  const badges = useBadges();
  const spotById = useMemo(() => new Map((spots.data ?? []).map((s) => [s.id, s])), [spots.data]);

  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string>("Made me feel unsafe");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    for (const k of [
      "social-summary",
      "taste-match",
      "person-activity",
      "edges",
      "feed",
      "meetups",
      "taste-matches",
    ])
      qc.invalidateQueries({ queryKey: [k] });
  };

  const block = async () => {
    setBusy(true);
    const { error } = await supabase.from("user_blocks").insert({ blocked_id: id });
    setBusy(false);
    setConfirmBlock(false);
    if (error) return void toast.error("Couldn't block. Try again.");
    toast.success(`${firstName(person)} is blocked`);
    refresh();
  };
  const unblock = async () => {
    if (!me) return;
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", me)
      .eq("blocked_id", id);
    if (error) return void toast.error("Couldn't unblock. Try again.");
    refresh();
  };
  const report = async () => {
    setBusy(true);
    const { error } = await supabase.from("user_reports").insert({ reported_user_id: id, reason });
    setBusy(false);
    if (error) return void toast.error("Couldn't send the report. Try again.");
    setReporting(false);
    toast.success("Thanks. Our team will look into it. You can also block them.");
  };

  const back = (
    <button
      onClick={() =>
        window.history.length > 1 ? router.history.back() : router.navigate({ to: "/social" })
      }
      className="grid size-10 place-items-center rounded-full bg-secondary"
      aria-label="Back"
    >
      <ArrowLeft className="size-5" />
    </button>
  );

  if (!valid || (!people.isLoading && !person))
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),1.25rem)] text-center">
        <div className="text-left">{back}</div>
        <p className="mt-16 text-5xl">🤷</p>
        <p className="mt-3 text-xl font-extrabold">We couldn't find this person</p>
      </div>
    );

  const s = summary.data;
  const self = me === id;
  const score = match.data != null ? Math.round(match.data) : null;
  const tone = score != null ? matchTone(score) : null;
  const friends = !!s?.i_follow && !!s?.follows_me;

  return (
    <div className="animate-screen px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <div className="flex items-center justify-between">
        {back}
        {me && !self && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-10 place-items-center rounded-full bg-secondary"
              aria-label="More"
            >
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-2xl">
              <DropdownMenuItem onClick={() => setReporting(true)}>
                <Flag className="size-4" /> Report
              </DropdownMenuItem>
              {s?.blocked ? (
                <DropdownMenuItem onClick={unblock}>
                  <Ban className="size-4" /> Unblock
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setConfirmBlock(true)}
                >
                  <Ban className="size-4" /> Block
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <section className="mt-4 flex flex-col items-center text-center">
        <div className="relative">
          <PersonAvatar person={person} size="size-28" text="text-5xl" />
          {tone && (
            <span
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-extrabold ring-4 ring-background ${tone.cls}`}
            >
              {score}% match
            </span>
          )}
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">{firstName(person)}</h1>
        {person?.username && <p className="text-sm text-muted-foreground">@{person.username}</p>}
        {person?.bio && <p className="mt-2 max-w-[300px] text-[15px]">{person.bio}</p>}
        {friends && (
          <span className="mt-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
            Friends
          </span>
        )}
        {s?.follows_me && !s.i_follow && (
          <span className="mt-2 rounded-full bg-secondary px-3 py-1 text-xs font-bold">
            Follows you
          </span>
        )}
      </section>

      {!loading && !me ? (
        <Button asChild size="xl" className="mt-6 w-full">
          <Link to="/auth">Sign in to follow</Link>
        </Button>
      ) : s?.blocked ? (
        <div className="mt-6 rounded-3xl bg-secondary p-5 text-center">
          <p className="font-bold">You blocked {firstName(person)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You won't see each other's activity or tables.
          </p>
          <Button variant="outline" className="mt-3 rounded-full" onClick={unblock}>
            Unblock
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["Stamps", s?.stamps],
                ["Spots", s?.spots],
                ["Badges", s?.badges],
                ["Followers", s?.followers],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-2xl bg-card py-3 shadow-card">
                <p className="text-xl font-extrabold">{n ?? "–"}</p>
                <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {me && !self && (
            <div className="mt-4 flex justify-center">
              <FollowButton me={me} them={id} />
            </div>
          )}
          {self && (
            <Button asChild variant="secondary" className="mt-4 w-full rounded-2xl">
              <Link to="/profile">Edit my social profile</Link>
            </Button>
          )}

          <h2 className="mb-3 mt-7 text-xl font-bold">Recent bites</h2>
          {activity.data?.length ? (
            <ul className="space-y-2">
              {activity.data.map((a) => {
                const spot = a.restaurant_id ? spotById.get(a.restaurant_id) : undefined;
                const badge = a.badge_id ? badges.data?.get(a.badge_id) : undefined;
                const { verb, emoji } = feedLine(a.kind);
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card"
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-lg">
                      {emoji}
                    </span>
                    <p className="min-w-0 flex-1 text-sm">
                      <span className="text-muted-foreground">
                        {verb.charAt(0).toUpperCase() + verb.slice(1)}
                      </span>{" "}
                      {spot && (
                        <Link to="/r/$slug" params={{ slug: spot.slug }} className="font-bold">
                          {spot.name}
                        </Link>
                      )}
                      {badge && (
                        <span className="font-bold">
                          {badge.icon} {badge.name}
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
              {self
                ? "Your stamps, reviews and badges will show here."
                : friends
                  ? "Nothing to show yet."
                  : `Follow each other to see where ${firstName(person)} eats.`}
            </p>
          )}
        </>
      )}

      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent className="max-w-[380px] rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Block {firstName(person)}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll unfollow each other, and they won't be able to see your activity, join your
              tables or see tables you're at. They won't be told.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={block}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reporting} onOpenChange={setReporting}>
        <DialogContent className="max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Report {firstName(person)}</DialogTitle>
            <DialogDescription>Reports are private. They won't know it was you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2" role="radiogroup">
            {REASONS.map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={`flex h-12 w-full items-center rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
                  reason === r ? "border-primary bg-primary-soft" : "border-border"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Button size="xl" className="w-full" disabled={busy} onClick={report}>
            Send report
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
