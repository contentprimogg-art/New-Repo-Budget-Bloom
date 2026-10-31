// Carte de contenu (disposition façon huddle): titre et description à gauche, action à droite,
// puis le contenu. Les cartes séparent les sections; les pointillés restent réservés aux lignes d'une liste.
export default function Card({
  title,
  description,
  action,
  className = '',
  children,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <section className={`rounded-3xl border border-border/80 bg-surface p-5 shadow-[0_1px_2px_rgb(26_29_32/0.04)] ${className}`}>
      {(title || action) && (
        <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-3 ${children ? 'mb-4' : ''}`}>
          <div className="min-w-[11rem] flex-1">
            {title && <h2 className="text-[17px] font-medium">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
