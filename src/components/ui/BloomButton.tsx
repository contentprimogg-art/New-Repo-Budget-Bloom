// Bouton « + » en forme de fleur (clin d'œil à Bloom): pétales rose pâle, cœur d'accent.
// La fleur tourne doucement au survol.
const PETALS = [0, 60, 120, 180, 240, 300]

export default function BloomButton({ label, onClick, size = 'md' }: { label: string; onClick: () => void; size?: 'md' | 'sm' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group no-print mx-auto flex flex-col items-center gap-1.5 py-2 font-medium text-accent-strong ${size === 'md' ? 'text-sm' : 'text-xs'}`}
    >
      <svg aria-hidden viewBox="-50 -50 100 100" className={`${size === 'md' ? 'size-16' : 'size-11'} transition-transform duration-700 ease-out group-hover:rotate-60`}>
        {PETALS.map((a) => (
          <ellipse key={a} cy={-25} rx={14} ry={21} transform={`rotate(${a})`} style={{ fill: 'var(--accent-soft)', stroke: 'var(--accent)', strokeWidth: 1.5 }} />
        ))}
        <circle r={17} style={{ fill: 'var(--accent-strong)' }} />
        <path d="M0 -7.5V7.5M-7.5 0H7.5" style={{ stroke: 'var(--on-accent)' }} strokeWidth={3} strokeLinecap="round" />
      </svg>
      {label}
    </button>
  )
}
