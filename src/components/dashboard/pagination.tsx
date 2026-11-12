import Link from "next/link";

/** Independent cursors preserve the other list's position on a shared page. */
export function Pagination({ path, parameter, previous, next, preserve = {}, label }: {
  path: string; parameter: string; previous: string | null; next: string | null;
  preserve?: Record<string, string | undefined>; label: string;
}) {
  if (!previous && !next) return null;
  function href(value: string) {
    const query = new URLSearchParams();
    for (const [key, current] of Object.entries(preserve)) if (current && key !== parameter) query.set(key, current);
    query.set(parameter, value);
    return `${path}?${query.toString()}`;
  }
  const style = "rounded-md border border-line bg-white px-3 py-2 text-[12px] font-medium text-ink transition-colors hover:border-accent hover:text-accent-strong";
  return <nav aria-label={label} className="mt-3 flex flex-wrap gap-2">{previous ? <Link className={style} href={href(previous)} scroll={false}>← Lebih baru</Link> : null}{next ? <Link className={style} href={href(next)} scroll={false}>Lebih lama →</Link> : null}</nav>;
}
