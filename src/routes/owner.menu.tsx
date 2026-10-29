import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatPrice } from "@/lib/bite";
import { DISH_TYPES } from "@/lib/dishes";
import { ImagePick } from "@/components/bite/ImagePick";
import { Route as OwnerRoute, useMyRestaurant } from "./owner";

export const Route = createFileRoute("/owner/menu")({ component: MenuManager });

type Draft = { id?: string; name: string; description: string; price: string; photo_url: string | null; is_available: boolean; category_id: string | null; is_secret: boolean; required_level: number; is_house_special: boolean; dish_type: string | null };
const field = "h-12 w-full rounded-2xl border bg-background px-4 text-base outline-none focus:border-primary";

function MenuManager() {
  const { userId } = OwnerRoute.useRouteContext();
  const { data: r } = useMyRestaurant();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState("");

  const menu = useQuery({
    queryKey: ["owner-menu", r?.id],
    enabled: !!r,
    queryFn: async () => {
      const [c, i] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("restaurant_id", r!.id).order("sort_order"),
        supabase.from("menu_items").select("*").eq("restaurant_id", r!.id).order("created_at"),
      ]);
      return { cats: c.data ?? [], items: i.data ?? [] };
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["owner-menu"] });
    qc.invalidateQueries({ queryKey: ["restaurant"] });
  };

  if (!r)
    return (
      <div className="p-8 text-center">
        <p>Set up your restaurant first.</p>
        <Link to="/owner/setup" className="font-semibold text-primary">Go to setup</Link>
      </div>
    );

  const cats = menu.data?.cats ?? [];
  const items = menu.data?.items ?? [];

  const addCat = async () => {
    if (!newCat.trim()) return;
    const { error } = await supabase.from("menu_categories").insert({ restaurant_id: r.id, name: newCat.trim(), sort_order: cats.length });
    if (error) { toast.error(error.message); return; }
    setNewCat("");
    refresh();
  };
  const renameCat = async (id: string, old: string) => {
    const name = prompt("Category name", old);
    if (!name) return;
    await supabase.from("menu_categories").update({ name }).eq("id", id);
    refresh();
  };
  const delCat = async (id: string) => {
    if (!confirm("Delete this category? Items stay but become uncategorised.")) return;
    await supabase.from("menu_categories").delete().eq("id", id);
    refresh();
  };
  const saveItem = async () => {
    if (!draft) return;
    const row = {
      restaurant_id: r.id, category_id: draft.category_id, name: draft.name, description: draft.description,
      price_cents: Math.round(parseFloat(draft.price || "0") * 100), photo_url: draft.photo_url, is_available: draft.is_available, is_secret: draft.is_secret, required_level: draft.is_secret ? draft.required_level : 0, is_house_special: draft.is_house_special && !draft.is_secret, dish_type: draft.dish_type,
    };
    if (row.is_house_special) {
      let clear = supabase.from("menu_items").update({ is_house_special: false }).eq("restaurant_id", r.id).eq("is_house_special", true);
      if (draft.id) clear = clear.neq("id", draft.id);
      const { error: clearError } = await clear;
      if (clearError) { toast.error(clearError.message); return; }
    }
    const { error } = draft.id
      ? await supabase.from("menu_items").update(row).eq("id", draft.id)
      : await supabase.from("menu_items").insert(row);
    if (error) { toast.error(error.message); return; }
    setDraft(null);
    refresh();
  };
  const delItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    refresh();
  };
  const toggleAvail = async (id: string, v: boolean) => {
    await supabase.from("menu_items").update({ is_available: v }).eq("id", id);
    refresh();
  };

  const groups = [...cats.map((c) => ({ id: c.id as string | null, name: c.name, real: true })), { id: null, name: "Uncategorised", real: false }];

  return (
    <div className="space-y-6 px-5 pt-5 animate-screen">
      <h1 className="text-2xl font-extrabold">Menu</h1>
      <div className="flex gap-2">
        <input className={field} placeholder="New category (e.g. Drinks)" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        <Button type="button" className="h-12 rounded-2xl" onClick={addCat}><Plus className="size-5" /></Button>
      </div>

      {groups.map((g) => {
        const list = items.filter((i) => i.category_id === g.id);
        if (!g.real && list.length === 0) return null;
        return (
          <section key={g.id ?? "none"}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="flex-1 text-lg font-bold">{g.name}</h2>
              {g.real && (
                <>
                  <button aria-label="Rename" className="grid size-10 place-items-center" onClick={() => renameCat(g.id!, g.name)}><Pencil className="size-4" /></button>
                  <button aria-label="Delete" className="grid size-10 place-items-center text-destructive" onClick={() => delCat(g.id!)}><Trash2 className="size-4" /></button>
                </>
              )}
            </div>
            <div className="space-y-2">
              {list.map((i) => (
                <div key={i.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
                  {i.photo_url ? <img src={i.photo_url} alt="" className="size-14 rounded-xl object-cover" /> : <div className="size-14 rounded-xl bg-muted" />}
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setDraft({ id: i.id, name: i.name, description: i.description ?? "", price: (i.price_cents / 100).toFixed(2), photo_url: i.photo_url, is_available: i.is_available, category_id: i.category_id, is_secret: i.is_secret, required_level: i.required_level, is_house_special: i.is_house_special, dish_type: i.dish_type })}
                  >
                    <p className="truncate font-semibold">{i.is_house_special && "⭐ "}{i.is_secret && "🤫 "}{i.name}</p>
                    <p className="text-sm font-bold text-primary">{formatPrice(i.price_cents)}</p>
                  </button>
                  <Switch checked={i.is_available} onCheckedChange={(v) => toggleAvail(i.id, v)} aria-label="Available" />
                  <button aria-label="Delete item" className="grid size-10 place-items-center text-destructive" onClick={() => delItem(i.id)}><Trash2 className="size-4" /></button>
                </div>
              ))}
              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-semibold text-muted-foreground"
                onClick={() => setDraft({ name: "", description: "", price: "", photo_url: null, is_available: true, category_id: g.id, is_secret: false, required_level: 1, is_house_special: false, dish_type: null })}
              >
                <Plus className="size-4" /> Add item
              </button>
            </div>
          </section>
        );
      })}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40" onClick={() => setDraft(null)}>
          <div className="max-h-[92dvh] w-full max-w-[430px] space-y-3 overflow-y-auto rounded-t-3xl bg-card p-5 pb-safe animate-screen" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold">{draft.id ? "Edit item" : "New item"}</h3>
            <ImagePick bucket="menu-photos" userId={userId} value={draft.photo_url} onChange={(u) => setDraft({ ...draft, photo_url: u })} label="Photo" className="h-32 w-full" />
            <input className={field} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input className={field} placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <input className={field} placeholder="Price (e.g. 6.50)" inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            <select className={field} value={draft.category_id ?? ""} onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}>
              <option value="">Uncategorised</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="flex h-12 items-center justify-between font-semibold">
              Available <Switch checked={draft.is_available} onCheckedChange={(v) => setDraft({ ...draft, is_available: v })} />
            </label>
            <label className="block text-sm font-semibold">
              Dish type for Best in the Peg rankings
              <select className={`${field} mt-1`} value={draft.dish_type ?? ""} onChange={(e) => setDraft({ ...draft, dish_type: e.target.value || null })}>
                <option value="">Not ranked</option>
                {DISH_TYPES.map((d) => <option key={d.key} value={d.key}>{d.emoji} {d.key}</option>)}
              </select>
            </label>
            <label className="flex h-12 items-center justify-between font-semibold">
              <span>
                ⭐ House special
                <span className="block text-xs font-normal text-muted-foreground">Featured at the top of your page and on the map</span>
              </span>
              <Switch checked={draft.is_house_special} onCheckedChange={(v) => setDraft({ ...draft, is_house_special: v, is_secret: v ? false : draft.is_secret })} />
            </label>
            <label className="flex h-12 items-center justify-between font-semibold">
              <span>🤫 Secret menu item</span>
              <Switch checked={draft.is_secret} onCheckedChange={(v) => setDraft({ ...draft, is_secret: v, is_house_special: v ? false : draft.is_house_special })} />
            </label>
            {draft.is_secret && (
              <label className="block text-sm font-semibold">
                Who can see it
                <select className={`${field} mt-1`} value={draft.required_level} onChange={(e) => setDraft({ ...draft, required_level: Number(e.target.value) })}>
                  <option value={0}>Any signed-in Bite user</option>
                  <option value={1}>🥈 Silver and up (5+ stamps)</option>
                  <option value={2}>🥇 Gold and up (15+ stamps)</option>
                  <option value={3}>🍁 Maple only (30+ stamps)</option>
                </select>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">Everyone else sees a locked teaser that makes them want to level up.</span>
              </label>
            )}
            <Button size="xl" className="w-full" disabled={!draft.name} onClick={saveItem}>Save item</Button>
          </div>
        </div>
      )}
    </div>
  );
}
