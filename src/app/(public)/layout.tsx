// Public route group — NO authentication. Used by customer self-explore links
// (/explore/[token]). The page-level loader enforces share_enabled + expiry and
// serves only a pricing-free, allowlisted projection of the deck.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas text-ink">{children}</div>;
}
