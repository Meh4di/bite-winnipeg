import { useEffect, useState } from "react";

/**
 * Bity Business is the owner side of the same codebase, installed as its own home-screen app.
 * While an owner is in /owner we point the page at the business manifest, icon and title,
 * so "Install" / "Add to Home Screen" there creates a separate "Bity Business" app that opens on /owner.
 */
export function useBusinessAppShell() {
  useEffect(() => {
    const swap = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector<HTMLElement>(selector);
      if (!el) return () => {};
      const before = el.getAttribute(attr) ?? "";
      el.setAttribute(attr, value);
      return () => el.setAttribute(attr, before);
    };
    const undo = [
      swap('link[rel="manifest"]', "href", "/business.webmanifest"),
      swap('link[rel="apple-touch-icon"]', "href", "/icons/biz-apple-touch-icon.png"),
      swap('meta[name="apple-mobile-web-app-title"]', "content", "Bity Business"),
      swap('meta[name="theme-color"]', "content", "#1C1917"),
    ];
    return () => undo.forEach((f) => f());
  }, []);
}

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/** Install state for the business app: Android/desktop prompt, iOS instructions, or already installed. */
export function useInstallBusinessApp() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia?.("(display-mode: standalone)").matches ?? false);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const ios =
    typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent ?? "");
  const install = async () => {
    if (!evt) return false;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    setEvt(null);
    return outcome === "accepted";
  };
  return { installed, canPrompt: !!evt, ios, install };
}
