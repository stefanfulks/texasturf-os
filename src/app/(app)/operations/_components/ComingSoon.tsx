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
    <main className="min-h-dvh bg-zinc-50 px-8 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <Link href="/operations" className="text-sm text-zinc-500 hover:underline">
            ← Warehouse
          </Link>
        </div>
        <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">{body}</div>
          {schemaNote && (
            <div className="mx-auto mt-3 max-w-md text-xs text-zinc-500">
              Schema is ready in <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{schemaNote}</code>.
              UI lands next.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
