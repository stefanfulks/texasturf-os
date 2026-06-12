"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { AssistantChat } from "@/app/(app)/assistant/chat";

/**
 * Floating Turfy launcher — visible on every authenticated page (mounted at
 * the (app) layout level). Click the floating button bottom-right to open a
 * popover containing the same chat UI as /assistant.
 *
 * State preservation: once the popover has been opened, the AssistantChat is
 * never unmounted — closing just hides it via CSS. So a mid-conversation user
 * who closes the popover, navigates to another page, and reopens picks up
 * exactly where they left off (the launcher lives in the layout, which
 * doesn't unmount during in-app navigation).
 *
 * Hidden on /assistant itself (would be redundant — that page is the full
 * version of the same chat).
 */
export function TurfyLauncher({ greetingName }: { greetingName: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  // Once opened, we keep the chat mounted forever (this component lives in
  // the layout, so "forever" means "for this tab session"). Lazy-mount means
  // the Anthropic SDK isn't loaded until first interaction.
  const [hasOpened, setHasOpened] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hide entirely on the full /assistant page — no point having two chat UIs.
  const onAssistantPage = pathname === "/assistant" || pathname.startsWith("/assistant/");

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  function open() {
    setHasOpened(true);
    setIsOpen(true);
  }

  if (onAssistantPage) return null;

  return (
    <>
      {/* Floating button — bottom-right, always visible when launcher is mounted */}
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        aria-label={isOpen ? "Close Turfy" : "Open Turfy"}
        aria-expanded={isOpen}
        className={
          // bottom offsets add env(safe-area-inset-bottom) so the FAB clears
          // the iPhone home indicator in the installed app (0 in browsers)
          "fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full " +
          "bg-ink text-white shadow-lg shadow-ink/20 " +
          "hover:bg-ink hover:scale-105 active:scale-95 transition-all " +
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-line-strong " +
          "sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-6"
        }
      >
        {isOpen ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {/* Popover panel — lazy-mounts on first open, then stays mounted (CSS
          hides/shows) so the conversation persists across close/reopen +
          page navigations. */}
      {hasOpened && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Turfy"
          aria-hidden={!isOpen}
          className={
            "fixed z-40 flex flex-col rounded-2xl border border-line bg-white shadow-2xl shadow-ink/10 " +
            // Desktop: anchor bottom-right above the FAB
            "sm:bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:right-6 sm:w-[400px] sm:h-[600px] sm:max-h-[calc(100vh-8rem)] " +
            // Mobile: near-fullscreen with margin (cleared above the home
            // indicator in the installed app)
            "inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] top-16 " +
            (isOpen ? "" : "hidden")
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-info-tint text-info">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold text-ink">Turfy</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Chat body — fills remaining height */}
          <div className="flex-1 min-h-0 p-2">
            <AssistantChat greetingName={greetingName} compact />
          </div>
        </div>
      )}
    </>
  );
}
