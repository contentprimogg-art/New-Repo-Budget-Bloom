// Colonnes du résumé du moodboard: petite étiquette en capitales « surlignée », grand montant,
// séparateurs verticaux en pointillés.
export interface SummaryItem {
  label: string
  value: string
  /** Couleur du trait de surligneur derrière l'étiquette. */
  tone: string
  valueClassName?: string
}

export default function SummaryColumns({ items }: { items: SummaryItem[] }) {
  return (
    <div className="@container">
      <dl className="grid grid-cols-1 gap-3 @3xl:grid-cols-3 @3xl:gap-0">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`flex min-w-0 flex-col items-center gap-1.5 px-1 text-center ${i > 0 ? '@3xl:border-l @3xl:border-dashed @3xl:border-muted/45' : ''}`}
          >
            <dt className="relative max-w-full text-[10.5px] font-semibold uppercase tracking-[0.16em] [overflow-wrap:anywhere]">
              <span aria-hidden className="absolute -inset-x-1.5 bottom-px h-[7px] rounded-sm opacity-35" style={{ background: item.tone }} />
              <span className="relative">{item.label}</span>
            </dt>
            <dd className={`max-w-full text-[clamp(0.9rem,3vw,1.25rem)] font-medium leading-tight tabular-nums [overflow-wrap:anywhere] ${item.valueClassName ?? ''}`}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
