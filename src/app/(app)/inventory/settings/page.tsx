export default function InventorySettingsPage() {
  const placeholderFields = [
    {
      key: "default_receiving_location_id",
      label: "Default Receiving Location",
      value: "—",
      help: "Location selected automatically when receiving new rolls.",
    },
    {
      key: "low_stock_threshold_factor",
      label: "Low Stock Threshold Factor",
      value: "1.0",
      help: "Multiplier applied to each item's min_quantity when computing the low-stock badge.",
    },
    {
      key: "auto_archive_completed_jobs_after_days",
      label: "Auto-Archive Completed Jobs After (days)",
      value: "—",
      help: "Number of days after a job is completed before it is archived from the active list.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Settings will be wired up once an <code className="text-xs px-1.5 py-0.5 bg-zinc-100 rounded">inv_settings</code> table
          is added. Showing read-only placeholders for the planned fields.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        These values are static placeholders. No values are read from or written to the database.
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden divide-y divide-zinc-100">
        {placeholderFields.map((f) => (
          <div key={f.key} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800">{f.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{f.help}</p>
              <p className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1 font-mono">
                {f.key}
              </p>
            </div>
            <div className="text-sm font-mono text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 min-w-[8rem] text-center">
              {f.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
