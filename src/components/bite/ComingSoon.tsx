import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  line,
  emoji,
}: {
  icon: LucideIcon;
  title: string;
  line: string;
  emoji: string;
}) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-8 text-center animate-screen">
      <div className="relative">
        <div className="grid size-32 place-items-center rounded-[2.5rem] bg-warm text-primary-foreground shadow-pop">
          <Icon className="size-14" strokeWidth={2.2} />
        </div>
        <span className="absolute -right-4 -top-4 text-4xl animate-float">{emoji}</span>
      </div>
      <span className="mt-8 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
        Coming soon
      </span>
      <h1 className="mt-3 text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 max-w-xs text-base text-muted-foreground">{line}</p>
    </div>
  );
}
