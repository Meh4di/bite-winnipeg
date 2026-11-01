import { useState } from "react";
import { Share, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInstallBusinessApp } from "@/lib/business-app";

const KEY = "bity-biz-install-dismissed";
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** "Put Bity Business on your phone": its own app icon that opens straight to the dashboard. */
export function InstallBusiness() {
  const { installed, canPrompt, ios, install } = useInstallBusinessApp();
  const [hidden, setHidden] = useState(read);
  if (installed || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode */
    }
  };

  return (
    <section className="relative flex gap-3 rounded-3xl bg-[#1C1917] p-4 text-white shadow-card">
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 opacity-60"
        aria-label="Hide this"
      >
        <X className="size-4" />
      </button>
      <img src="/icons/biz-192.png" alt="" className="size-14 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 pr-4">
        <p className="font-extrabold">Get the Bity Business app</p>
        <p className="mt-0.5 text-sm opacity-80">
          Its own icon on your phone, separate from the customer app. Opens straight to your orders
          and deals.
        </p>
        {canPrompt ? (
          <Button
            size="sm"
            className="mt-3 rounded-full"
            onClick={async () => {
              if (await install()) toast.success("Bity Business is on your home screen");
            }}
          >
            Install
          </Button>
        ) : ios ? (
          <p className="mt-2 text-xs font-semibold opacity-90">
            In Safari, tap <Share className="inline size-3.5" /> Share, then{" "}
            <b>Add to Home Screen</b>.
          </p>
        ) : (
          <p className="mt-2 text-xs font-semibold opacity-90">
            In your browser menu, choose <b>Install app</b> or <b>Add to Home screen</b>.
          </p>
        )}
      </div>
    </section>
  );
}
