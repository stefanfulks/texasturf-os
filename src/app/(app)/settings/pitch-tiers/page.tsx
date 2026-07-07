import { redirectIfNotAdmin } from "../_lib/require-admin";
import { getAllTiers, getInventoryProducts } from "@/lib/pitch/queries";
import { TierForm } from "./tier-form";

export default async function PitchTiersSettingsPage() {
  await redirectIfNotAdmin();
  const [tiers, products] = await Promise.all([getAllTiers(), getInventoryProducts()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      <div>
        <h1 className="page-title">Pitch tiers</h1>
        <p className="text-sm text-ink-3">Feature the product, margin, inclusions, and warranty shown for Silver / Gold / Platinum in the sales deck. Rotate products as stock changes.</p>
      </div>
      {tiers.map((tier) => (<TierForm key={tier.id} tier={tier} products={products} />))}
    </div>
  );
}
