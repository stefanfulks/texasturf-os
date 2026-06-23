import { getPublicDeckByToken } from "@/lib/pitch/public-deck";
import { ReadOnlyDeck } from "@/app/(present)/present/[sessionId]/read-only-deck";

export const dynamic = "force-dynamic";

export default async function ExplorePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const deck = await getPublicDeckByToken(token);

  if (!deck) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="display text-2xl mb-2">Link unavailable</h1>
          <p className="text-ink-3">This presentation link is no longer active. Ask your Texas Turf rep for a fresh one.</p>
        </div>
      </div>
    );
  }

  return <ReadOnlyDeck slides={deck.slides} display={deck.display} />;
}
