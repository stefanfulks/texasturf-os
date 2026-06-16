import { notFound } from "next/navigation";
import { getPitchSession, getDeckSlidesForSession } from "@/lib/pitch/queries";
import { DeckPlayer } from "./deck-player";

export default async function PresentPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const [session, slides] = await Promise.all([
    getPitchSession(sessionId),
    getDeckSlidesForSession(sessionId),
  ]);
  if (!session) notFound();
  return <DeckPlayer session={session} slides={slides} />;
}
