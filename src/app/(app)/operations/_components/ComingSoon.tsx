import Link from "next/link";

export function ComingSoon({
  title,
  body,
  schemaNote,
}: {
  title: string;
  body: string;
  schemaNote?: string;
}) {
  return (
    <main className="min-h-dvh bg-hover px-8 py-12 dark:bg-ink">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <Link href="/operations" className="text-sm text-ink-3 hover:underline">
            ← Warehouse
          </Link>
        </div>
        <div className="mt-8 rounded-lg border border-dashed border-line-strong p-10 text-center dark:border-line-strong">
          <div className="text-sm text-ink-2 dark:text-ink-4">{body}</div>
          {schemaNote && (
            <div className="mx-auto mt-3 max-w-md text-xs text-ink-3">
              Schema is ready in <code className="rounded bg-sunken px-1 dark:bg-ink">{schemaNote}</code>.
              UI lands next.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
