import { notFound } from "next/navigation";
import { getPitchSession, getDeckSlidesForSession } from "@/lib/pitch/queries";
import { DeckPlayer } from "./deck-player";
import { KioskDeck } from "./kiosk-deck";

export default async function PresentPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ kiosk?: string }>;
}) {
  const { sessionId } = await params;
  const { kiosk } = await searchParams;
  const [session, slides] = await Promise.all([
    getPitchSession(sessionId),
    getDeckSlidesForSession(sessionId),
  ]);
  if (!session) notFound();

  if (kiosk === "1") {
    // Customer self-explore on the tablet — strip pricing + close (no selling to self).
    const exploreSlides = slides.filter((s) => s.kind !== "pricing" && s.kind !== "close");
    return <KioskDeck sessionId={sessionId} slides={exploreSlides} display={{ prospectName: session.prospectName, address: session.address }} />;
  }

  return <DeckPlayer session={session} slides={slides} />;
}
