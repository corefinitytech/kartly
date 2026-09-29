export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[680px] px-4 py-10 lg:px-6">
      <h1 className="text-2xl font-bold lg:text-3xl">{title}</h1>
      <p className="mt-2 rounded-badge bg-warningTint px-3 py-2 text-sm text-warning">
        Template. This page needs legal review before production use.
      </p>
      <div className="prose-plain mt-6 space-y-4 text-base text-ink">{children}</div>
    </div>
  );
}
