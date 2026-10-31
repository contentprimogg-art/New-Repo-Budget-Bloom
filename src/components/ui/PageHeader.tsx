// En-tête façon moodboard: un élément à gauche, un titre centré en capitales espacées, un à droite.
export default function PageHeader({
  left,
  center,
  right,
}: {
  left?: React.ReactNode
  center: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <header className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
      <div className="flex justify-start">{left}</div>
      <div className="flex min-w-0 items-center justify-center text-[13px] font-semibold uppercase tracking-[0.22em]">{center}</div>
      <div className="flex justify-end">{right}</div>
    </header>
  )
}

export function IconButton({
  label,
  onClick,
  href,
  children,
  disabled,
}: {
  label: string
  onClick?: () => void
  href?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  const cls = 'no-print grid size-10 place-items-center rounded-full text-text hover:bg-accent-soft disabled:opacity-30'
  return href ? (
    <a href={href} aria-label={label} title={label} className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled} className={cls}>
      {children}
    </button>
  )
}
