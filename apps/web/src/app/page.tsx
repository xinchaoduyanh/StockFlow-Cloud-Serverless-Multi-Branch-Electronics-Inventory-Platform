const modules = [
  "Async Excel imports",
  "Branch inventory",
  "Transfer approval",
  "Stock movement ledger",
];

export default function Home() {
  return (
    <main className="mx-auto w-[calc(100%_-_48px)] max-w-[1120px] py-20 max-md:w-[calc(100%_-_32px)] max-md:py-12">
      <section className="max-w-[720px]">
        <p className="mb-3 text-sm font-bold uppercase tracking-normal text-accent">
          StockFlow Cloud
        </p>
        <h1 className="m-0 text-[clamp(2.5rem,6vw,4.75rem)] leading-none tracking-normal">
          Electronics inventory for multi-branch operations
        </h1>
        <p className="mt-6 text-lg leading-7 text-muted">
          A serverless-ready platform for Excel imports, stock tracking, transfer approvals, and
          operational reporting.
        </p>
      </section>

      <section
        className="mt-14 grid grid-cols-4 gap-4 max-md:grid-cols-1"
        aria-label="Core modules"
      >
        {modules.map((module) => (
          <article
            className="flex min-h-28 items-end rounded-lg border border-border bg-white p-5 font-bold"
            key={module}
          >
            <span>{module}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
