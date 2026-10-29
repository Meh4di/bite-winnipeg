import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
export function Quantity({ name, quantity, onChange, disabled = false }: { name: string; quantity: number; onChange: (delta: number) => void; disabled?: boolean }) {
  return <div className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-secondary">
    <Button variant="ghost" size="icon" className="size-11" aria-label={`Remove one ${name}`} disabled={disabled} onClick={() => onChange(-1)}><Minus /></Button>
    <span className="w-6 text-center font-bold tabular-nums">{quantity}</span>
    <Button variant="ghost" size="icon" className="size-11" aria-label={`Add one ${name}`} disabled={disabled || quantity >= 99} onClick={() => onChange(1)}><Plus /></Button>
  </div>;
}