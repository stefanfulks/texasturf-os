import { Tags } from "lucide-react";

export default function TurfcasaCatalogPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">TurfCasa</p>
        <h1 className="page-title">Catalog</h1>
        <p className="mt-1 text-sm text-ink-2">
          Turf and accessories with a trade price and a retail price on every SKU — the one thing
          Jobber&apos;s single-price catalog can&apos;t do.
        </p>
      </div>
      <div className="panel">
        <div className="empty-state">
          <span className="medallion medallion-warn"><Tags className="h-5 w-5" /></span>
          <p className="empty-state-title">Catalog ships with the quoting build</p>
          <p className="empty-state-body">
            Landscape turf, pet and putting-green lines, infill, fasteners, adhesives, edging,
            and ground prep — taxable flags included, since outlet sales are taxed unlike
            install-bundled lines.
          </p>
        </div>
      </div>
    </div>
  );
}
