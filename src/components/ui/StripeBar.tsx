// Barre « à rayures » du moodboard: traits verticaux fins, couleur d'accent pour le dépensé,
// vert pour ce qui reste, rouge si le budget est dépassé.
export default function StripeBar({
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
  const [line, gap] = size === 'lg' ? [2, 3.5] : [1.5, 2.5]
  const stripes = (color: string) =>
    `repeating-linear-gradient(90deg, ${color} 0 ${line}px, transparent ${line}px ${line + gap}px)`

  return (
    <div role="img" aria-label={label} className={`flex w-full overflow-hidden ${size === 'lg' ? 'h-6' : 'h-2.5'}`}>
      {ratio > 0 && (
        <div
          className="h-full shrink-0"
          style={{ width: `${ratio * 100}%`, backgroundImage: stripes(over ? 'var(--over)' : 'var(--accent-strong)') }}
        />
      )}
      {!over && ratio < 1 && <div className="h-full flex-1" style={{ backgroundImage: stripes('var(--ok)') }} />}
    </div>
  )
}
