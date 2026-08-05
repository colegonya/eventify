// The one deliberate color signature on every top-level page: a short
// brand-primary rule under the page's own name, not a full-width neutral
// line under the whole toolbar (which just doubled the header's own rule).
export function Masthead({ as: Tag = "h1", children }) {
  return (
    <Tag className="inline-block border-b-[3px] border-brand-primary pb-1 text-2xl font-bold tracking-tight text-brand-ink">
      {children}
    </Tag>
  );
}
