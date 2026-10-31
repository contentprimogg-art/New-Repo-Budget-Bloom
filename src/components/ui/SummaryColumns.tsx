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
    <dl className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex min-w-0 flex-col items-center gap-1.5 px-1 text-center ${i > 0 ? 'border-l border-dashed border-muted/45' : ''}`}
        >
          <dt className="relative text-[10.5px] font-semibold uppercase tracking-[0.16em]">
            <span aria-hidden className="absolute -inset-x-1.5 bottom-px h-[7px] rounded-sm opacity-35" style={{ background: item.tone }} />
            <span className="relative">{item.label}</span>
          </dt>
          {/* Taille qui s'adapte à la largeur disponible (carte sur téléphone) sans couper les montants. */}
          <dd className={`max-w-full text-[clamp(0.9rem,4.1vw,1.25rem)] font-medium leading-tight tabular-nums ${item.valueClassName ?? ''}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
