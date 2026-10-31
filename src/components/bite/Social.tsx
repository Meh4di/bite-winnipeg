import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  acceptRules,
  firstName,
  isAdultDate,
  useMyEdges,
  useMySocial,
  USERNAME_RE,
  type Person,
} from "@/lib/social";

export function PersonAvatar({
  person,
  size = "size-11",
  text = "text-lg",
}: {
  person?: Pick<Person, "full_name" | "avatar_url"> | null | undefined;
  size?: string;
  text?: string;
}) {
  if (person?.avatar_url)
    return <img src={person.avatar_url} alt="" className={`${size} rounded-full object-cover`} />;
  return (
    <span
      className={`${size} ${text} grid shrink-0 place-items-center rounded-full bg-warm font-display font-extrabold text-primary-foreground`}
    >
      {firstName(person).charAt(0).toUpperCase()}
    </span>
  );
}

export function FollowButton({ me, them, small }: { me: string; them: string; small?: boolean }) {
  const qc = useQueryClient();
  const edges = useMyEdges(me);
  const [busy, setBusy] = useState(false);
  const iFollow = edges.data?.following.has(them) ?? false;
  const followsMe = edges.data?.followers.has(them) ?? false;
  if (me === them) return null;

  const toggle = async () => {
    setBusy(true);
    const { error } = iFollow
      ? await supabase.from("user_follows").delete().eq("follower_id", me).eq("followee_id", them)
      : await supabase.from("user_follows").insert({ followee_id: them });
    setBusy(false);
    if (error) return void toast.error("Couldn't update. Try again.");
    if (!iFollow && followsMe)
      toast.success("You're friends now 🎉 Their activity shows in your feed.");
    qc.invalidateQueries({ queryKey: ["edges"] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["social-summary"] });
  };

  const label = iFollow
    ? followsMe
      ? "Friends"
      : "Following"
    : followsMe
      ? "Follow back"
      : "Follow";
  const Icon = iFollow ? (followsMe ? Users : UserCheck) : UserPlus;
  return (
    <Button
      size={small ? "sm" : "lg"}
      variant={iFollow ? "secondary" : "default"}
      disabled={busy || edges.isLoading}
      onClick={toggle}
      className={small ? "h-9 rounded-full px-3.5" : "rounded-full"}
    >
      <Icon className="size-4" /> {label}
    </Button>
  );
}

export const TABLE_RULES = [
  ["🔞", "18+ only", "Everyone at a table has added a birthday showing they're 18 or older."],
  [
    "👥",
    "Friends only",
    "Only people you follow who follow you back can see or join your table. No strangers.",
  ],
  [
    "🍽️",
    "Public spots only",
    "Every table is at a restaurant on Bity, never a home or private place.",
  ],
  ["🙈", "Your info stays private", "Only people who join a table see who else is going."],
  [
    "🚫",
    "Block and report anytime",
    "Blocked people can't see or join your tables, or see you at all.",
  ],
] as const;

export function TableRulesDialog({
  open,
  onOpenChange,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAccept: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold">
            <ShieldCheck className="size-6 text-primary" /> Table rules
          </DialogTitle>
          <DialogDescription>Quick read before you eat with new people.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {TABLE_RULES.map(([e, t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="text-2xl">{e}</span>
              <span>
                <span className="block font-bold">{t}</span>
                <span className="block text-sm text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">
          Tell a friend where you're going, and leave whenever you want. If anything feels off,
          report it from the person's profile.
        </p>
        <Button
          size="xl"
          className="w-full"
          onClick={() => {
            acceptRules();
            onAccept();
          }}
        >
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}

const field =
  "h-12 w-full rounded-2xl border bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

export async function saveBirthday(userId: string, date: string) {
  return supabase.from("profile_private").upsert({ user_id: userId, birth_date: date });
}

/** Shown on Tables when we don't know the person is 18+. */
export function BirthdayGate({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!date) return;
    if (!isAdultDate(date)) return void toast.error("Tables are for people 18 and over.");
    setBusy(true);
    const { error } = await saveBirthday(userId, date);
    setBusy(false);
    if (error) return void toast.error("Couldn't save. Try again.");
    toast.success("Thanks! Tables are open to you.");
    qc.invalidateQueries({ queryKey: ["my-social"] });
    qc.invalidateQueries({ queryKey: ["meetups"] });
  };
  return (
    <div className="rounded-3xl bg-card p-5 shadow-card">
      <p className="text-3xl">🎂</p>
      <p className="mt-2 text-lg font-extrabold">Tables are for 18+</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your birthday to see and join tables. Only you can see it; it's never shown on your
        profile.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          type="date"
          aria-label="Birthday"
          className={field}
          max={new Date().toISOString().slice(0, 10)}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button size="lg" className="h-12 rounded-2xl" disabled={!date || busy} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

/** Username, bio, birthday and privacy switches, on the Profile tab. */
export function SocialSettings({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const mine = useMySocial(userId);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [birth, setBirth] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mine.data) return;
    setUsername(mine.data.username ?? "");
    setBio(mine.data.bio ?? "");
    setBirth(mine.data.birth_date ?? "");
  }, [mine.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-social"] });
    qc.invalidateQueries({ queryKey: ["people"] });
    qc.invalidateQueries({ queryKey: ["taste-matches"] });
    qc.invalidateQueries({ queryKey: ["meetups"] });
  };

  const toggle = async (col: "discoverable" | "share_activity", v: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update(col === "discoverable" ? { discoverable: v } : { share_activity: v })
      .eq("id", userId);
    if (error) return void toast.error("Couldn't update. Try again.");
    refresh();
  };

  const save = async () => {
    const u = username.trim().toLowerCase();
    if (u && !USERNAME_RE.test(u))
      return void toast.error("Usernames are 3 to 20 letters, numbers or underscores.");
    if (birth && !isAdultDate(birth) && new Date(birth) > new Date())
      return void toast.error("That birthday is in the future.");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: u || null, bio: bio.trim() || null })
      .eq("id", userId);
    if (!error && birth && birth !== mine.data?.birth_date) {
      const r = await saveBirthday(userId, birth);
      if (r.error) {
        setBusy(false);
        return void toast.error("Couldn't save your birthday.");
      }
    }
    setBusy(false);
    if (error)
      return void toast.error(
        error.code === "23505" ? "That username is taken." : "Couldn't save. Try again.",
      );
    toast.success("Saved");
    refresh();
  };

  return (
    <section className="mt-7 space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-bold">Social</h2>
        <Link
          to="/people/$id"
          params={{ id: userId }}
          className="text-sm font-semibold text-primary"
        >
          View my page
        </Link>
      </div>
      <div className="space-y-3 rounded-3xl bg-card p-4 shadow-card">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Username</span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <input
              className={`${field} pl-8`}
              placeholder="your_name"
              maxLength={20}
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Bio</span>
          <textarea
            className="min-h-20 w-full rounded-2xl border bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            placeholder="Tacos > everything."
            maxLength={160}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Birthday</span>
          <input
            type="date"
            className={field}
            max={new Date().toISOString().slice(0, 10)}
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Private. Only used to check you're 18+ for tables.
          </span>
        </label>
        <Button size="lg" className="w-full rounded-2xl" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      <PrivacyRow
        title="Show me in Taste Match"
        sub="Let other foodies find you by taste. Off by default."
        checked={mine.data?.discoverable ?? false}
        onChange={(v) => toggle("discoverable", v)}
      />
      <PrivacyRow
        title="Share my activity with friends"
        sub="Friends see your stamps, reviews and badges, always 1 hour late."
        checked={mine.data?.share_activity ?? true}
        onChange={(v) => toggle("share_activity", v)}
      />
    </section>
  );
}

function PrivacyRow({
  title,
  sub,
  checked,
  onChange,
}: {
  title: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-secondary p-4">
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
