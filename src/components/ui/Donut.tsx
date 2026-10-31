import { useState } from 'react'
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

// Anneau en aplats: chaque part de sa couleur, séparée des autres par un liseré de la couleur du fond.
// Bulle d'icône et pourcentage à l'extérieur des parts assez grandes; détail au survol ou à l'appui.
export default function Donut({
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
  const [active, setActive] = useState<number | null>(null)
  const parts = slices.filter((s) => s.value > 0)
  const total = parts.reduce((sum, s) => sum + s.value, 0)
  const pad = labels ? 46 : 3
  const c = size / 2
  const R = c - pad
  const r = R * 0.62
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
        {total === 0 ? (
          <circle cx={c} cy={c} r={(R + r) / 2} fill="none" style={{ stroke: 'var(--track)' }} strokeWidth={R - r} />
        ) : (
          parts.map((s, i) => (
            <path
              key={s.key}
              d={arc(c, R, r, geometry[i].a0, geometry[i].a1)}
              style={{ fill: s.color, stroke: gapColor }}
              strokeWidth={parts.length > 1 ? 2.5 : 0}
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
                {Glyph ? (
                  <Glyph x={bx - 6.5} y={by - 6.5} width={13} height={13} color="#fff" strokeWidth={2.2} />
                ) : (
                  s.icon && (
                    <text x={bx} y={by} dy="0.35em" textAnchor="middle" fontSize={12} className="emoji">
                      {s.icon}
                    </text>
                  )
                )}
                <text x={bx} y={by + 23} textAnchor="middle" fontSize={10} style={{ fill: 'var(--muted)' }}>
                  {Math.round(g.share * 100)}%
                </text>
              </g>
            )
          })}
      </svg>
      <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center" style={{ inset: innerInset }}>
        {focused ? (
          <>
            <span className="max-w-full truncate text-xs text-muted">{focused.label}</span>
            <span className="min-w-0 max-w-full text-base font-semibold tabular-nums [overflow-wrap:anywhere]">{format(focused.value)}</span>
            <span className="text-xs text-muted">{Math.round((focused.value / total) * 100)}%</span>
          </>
        ) : (
          center
        )}
      </div>
    </figure>
  )
}
