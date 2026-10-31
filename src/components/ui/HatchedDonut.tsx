import { useId, useState } from 'react'
import { ICONS } from '../../lib/icons'

export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
  icon?: string | null
}

const TAU = Math.PI * 2

function point(c: number, radius: number, angle: number) {
  return [c + radius * Math.cos(angle), c + radius * Math.sin(angle)]
}

// Secteur d'anneau entre deux angles (un tour complet est tracé en deux moitiés).
function arc(c: number, R: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= TAU - 1e-6) return arc(c, R, r, a0, a0 + Math.PI) + arc(c, R, r, a0 + Math.PI, a0 + TAU)
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = point(c, R, a0)
  const [x1, y1] = point(c, R, a1)
  const [x2, y2] = point(c, r, a1)
  const [x3, y3] = point(c, r, a0)
  return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z`
}

// Anneau hachuré façon moodboard: chaque part est remplie de fines rayures de sa couleur
// (angles alternés 45°/135°: la texture distingue aussi les parts sans la couleur),
// séparées par un liseré de la couleur du fond. Bulle d'icône et pourcentage à l'extérieur.
export default function HatchedDonut({
  slices,
  size = 260,
  labels = true,
  center,
  ariaLabel,
  format,
  gapColor = 'var(--surface)',
}: {
  slices: DonutSlice[]
  size?: number
  labels?: boolean
  center?: React.ReactNode
  ariaLabel: string
  format: (n: number) => string
  gapColor?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [active, setActive] = useState<number | null>(null)
  const parts = slices.filter((s) => s.value > 0)
  const total = parts.reduce((sum, s) => sum + s.value, 0)
  const pad = labels ? 46 : 3
  const c = size / 2
  const R = c - pad
  const r = R * 0.56
  const innerInset = `${((pad + R - r) / size) * 100}%`

  let angle = -Math.PI / 2
  const geometry = parts.map((s) => {
    const a0 = angle
    const a1 = angle + (s.value / total) * TAU
    angle = a1
    return { a0, a1, mid: (a0 + a1) / 2, share: s.value / total }
  })

  const focused = active !== null ? parts[active] : null

  return (
    <figure className="relative mx-auto aspect-square w-full" style={{ maxWidth: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel} className="block size-full overflow-visible">
        <defs>
          {parts.map((s, i) => (
            <pattern
              key={s.key}
              id={`${uid}-${i}`}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${i % 2 ? -45 : 45})`}
            >
              <rect width="6" height="6" style={{ fill: s.color, fillOpacity: 0.1 }} />
              <rect width="2.2" height="6" style={{ fill: s.color }} />
            </pattern>
          ))}
        </defs>
        {total === 0 ? (
          <circle cx={c} cy={c} r={(R + r) / 2} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={R - r} strokeDasharray="3 5" />
        ) : (
          parts.map((s, i) => (
            <path
              key={s.key}
              d={arc(c, R, r, geometry[i].a0, geometry[i].a1)}
              fill={`url(#${uid}-${i})`}
              style={{ stroke: gapColor }}
              strokeWidth={2}
              strokeLinejoin="round"
              opacity={active === null || active === i ? 1 : 0.35}
              tabIndex={0}
              aria-label={`${s.label}: ${format(s.value)} (${Math.round(geometry[i].share * 100)} %)`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(active === i ? null : i)}
              className="cursor-pointer outline-none transition-opacity"
            />
          ))
        )}
        {labels &&
          parts.map((s, i) => {
            const g = geometry[i]
            if (g.share < 0.05) return null
            const [bx, by] = point(c, R + 20, g.mid)
            const Glyph = s.icon ? ICONS[s.icon] : undefined
            return (
              <g key={s.key} aria-hidden opacity={active === null || active === i ? 1 : 0.35}>
                <circle cx={bx} cy={by} r={11} style={{ fill: s.color }} />
                {Glyph && <Glyph x={bx - 6.5} y={by - 6.5} width={13} height={13} color="#fff" strokeWidth={2.2} />}
                <text x={bx} y={by + 23} textAnchor="middle" fontSize={10} style={{ fill: 'var(--muted)' }}>
                  {Math.round(g.share * 100)}%
                </text>
              </g>
            )
          })}
      </svg>
      <div
        className="pointer-events-none absolute flex flex-col items-center justify-center text-center"
        style={{ inset: innerInset }}
      >
        {focused ? (
          <>
            <span className="max-w-full truncate text-xs text-muted">{focused.label}</span>
            <span className="text-base font-semibold tabular-nums">{format(focused.value)}</span>
            <span className="text-xs text-muted">{Math.round((focused.value / total) * 100)}%</span>
          </>
        ) : (
          center
        )}
      </div>
    </figure>
  )
}
