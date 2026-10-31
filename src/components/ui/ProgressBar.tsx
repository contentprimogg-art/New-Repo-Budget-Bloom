// Barre de progression: fond toujours gris neutre, seule la progression prend la couleur d'accent
// (rouge en cas de dépassement). Ainsi, quelle que soit la palette choisie, on lit la barre d'un coup d'œil.
export default function ProgressBar({
  spent,
  budget,
  size = 'lg',
  label,
}: {
  spent: number
  budget: number
  size?: 'lg' | 'sm'
  label: string
}) {
  const over = spent > budget
  const ratio = budget > 0 ? Math.min(spent / budget, 1) : spent > 0 ? 1 : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={`w-full overflow-hidden rounded-full bg-track ${size === 'lg' ? 'h-3' : 'h-1.5'}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${over ? 'bg-over' : 'bg-accent-strong'}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
