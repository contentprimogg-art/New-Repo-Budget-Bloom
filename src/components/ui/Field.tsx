// Champ du style calligraphique: petite étiquette en capitales, saisie soulignée en pointillés.
export default function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string | null
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>
      {children}
      {error ? <span className="text-xs text-over">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export const PRIMARY = 'w-full rounded-full bg-accent-strong px-5 py-3 font-semibold text-on-accent shadow-md shadow-accent/30'
export const SECONDARY = 'rounded-full bg-accent-soft px-5 py-2.5 font-medium text-accent-strong'
