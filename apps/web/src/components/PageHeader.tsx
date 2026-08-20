export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-7">
      <span className="text-[10px] font-bold tracking-[.14em] text-slate-400">{eyebrow}</span>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </header>
  );
}
