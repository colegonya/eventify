export default function ContactsLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="h-6 w-28 animate-pulse rounded bg-brand-ink/10" />
      <div className="h-64 w-full animate-pulse rounded-xl border border-brand-ink/10 bg-white shadow-sm" />
    </div>
  );
}
