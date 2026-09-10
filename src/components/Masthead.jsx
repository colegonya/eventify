// The one deliberate color signature on every top-level page: a short
// brand-primary rule under the page's own name, not a full-width neutral
// line under the whole toolbar (which just doubled the header's own rule).
export function Masthead({ as: Tag = "h1", children }) {
  return (
    // w-fit, not just inline-block: every page puts this in a flex container,
    // which blockifies the display and then stretches it to the full width.
    <Tag className="inline-block w-fit border-b-[3px] border-brand-primary pb-1 text-2xl font-bold tracking-tight text-brand-ink">
      {children}
    </Tag>
  );
}
