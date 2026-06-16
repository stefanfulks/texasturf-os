import { notFound } from "next/navigation";
import { getDeck } from "@/lib/pitch/queries";
import { DeckEditor } from "./deck-editor";
import type { StoredSlide } from "@/lib/pitch/deck";

export default async function DeckEditPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const deck = await getDeck(deckId);
  if (!deck) notFound();
  const slides = Array.isArray(deck.slides) ? (deck.slides as StoredSlide[]) : [];
  return <DeckEditor deckId={deck.id} name={deck.name} initialSlides={slides} />;
}
