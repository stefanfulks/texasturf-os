import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-dvh bg-zinc-50 px-8 py-16 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          TexasTurf Command Center
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Internal ops console. Jobber stays for client billing — this is for
          everything else.
        </p>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <Card
            href="/today"
            title="Today's visits"
            body="Visits scheduled today, grouped by crew."
          />
          <Card
            href="/clients"
            title="Clients"
            body="Searchable list of Jobber clients."
          />
          <Card
            href="/warehouse"
            title="Warehouse"
            body="Pull lists, inspections, deliveries, vehicle + tool spend."
          />
          <Card
            href="/settings/jobber"
            title="Connect Jobber"
            body="OAuth install and webhook status."
          />
        </section>
      </div>
    </main>
  );
}

function Card({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {body}
      </div>
    </Link>
  );
}
