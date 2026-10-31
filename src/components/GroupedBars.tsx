import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface BarSeries {
  key: string
  label: string
  /** Couleur de la marque (jamais celle du texte). */
  color: string
  values: number[]
}

const BAR_MAX = 24 // épaisseur maximale d'une barre
const GAP = 2 // espace entre barres voisines (couleur de la surface)
const RADIUS = 4 // arrondi côté valeur, coin carré sur la ligne de base
const MARGIN = { top: 10, right: 8, bottom: 28, left: 44 }

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

// Graduations rondes (1, 2, 5 × 10ⁿ).
function niceScale(maxValue: number) {
  const raw = Math.max(maxValue, 1) / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const f = raw / p
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
  const top = Math.ceil(Math.max(maxValue, 1) / step) * step
  return { step, top }
}

const roundedTop = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(RADIUS, w / 2, h)
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`
}

export default function GroupedBars({
  categories,
  tooltipTitles,
  series,
  format,
  ariaLabel,
  height = 220,
}: {
  categories: string[]
  /** Titre plus complet de chaque catégorie, affiché dans l'infobulle. */
  tooltipTitles?: string[]
  series: BarSeries[]
  format: (n: number) => string
  ariaLabel: string
  height?: number
}) {
  const { t, i18n } = useTranslation()
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  const n = categories.length
  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 10)
  const plotH = height - MARGIN.top - MARGIN.bottom
  const maxValue = Math.max(0, ...series.flatMap((s) => s.values))
  const { step, top } = niceScale(maxValue)
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const y = (v: number) => MARGIN.top + plotH - (v / top) * plotH
  const band = plotW / Math.max(n, 1)
  const barW = Math.max(2, Math.min(BAR_MAX, (band * 0.7 - (series.length - 1) * GAP) / series.length))
  const groupW = barW * series.length + GAP * (series.length - 1)
  const labelEvery = Math.max(1, Math.ceil(52 / band))
  const compact = (v: number) => new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 }).format(v)

  const tipLeft = hover === null ? 0 : Math.min(Math.max(MARGIN.left + (hover + 0.5) * band, 90), Math.max(width - 90, 90))

  return (
    <figure className="flex flex-col gap-2">
      <div ref={ref} className="relative">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
            {/* Remplissage hachuré (style du moodboard), un angle par série */}
            <defs>
              {series.map((s, si) => (
                <pattern key={s.key} id={`${uid}-${si}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform={`rotate(${si % 2 ? -45 : 45})`}>
                  <rect width="5" height="5" style={{ fill: s.color, fillOpacity: 0.14 }} />
                  <rect width="2" height="5" style={{ fill: s.color }} />
                </pattern>
              ))}
            </defs>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
                <text x={MARGIN.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} style={{ fill: 'var(--muted)' }}>
                  {compact(v)}
                </text>
              </g>
            ))}
            {categories.map((c, i) => {
              const gx = MARGIN.left + i * band + (band - groupW) / 2
              return (
                <g key={`${c}-${i}`}>
                  {hover === i && (
                    <rect x={MARGIN.left + i * band} y={MARGIN.top} width={band} height={plotH} style={{ fill: 'var(--accent-soft)' }} opacity={0.5} />
                  )}
                  {series.map((s, si) => {
                    const h = (s.values[i] / top) * plotH
                    return h > 0 ? (
                      <path
                        key={s.key}
                        d={roundedTop(gx + si * (barW + GAP), y(s.values[i]), barW, h)}
                        fill={`url(#${uid}-${si})`}
                        style={{ stroke: s.color }}
                        strokeWidth={1}
                      />
                    ) : null
                  })}
                  {i % labelEvery === 0 && (
                    <text x={MARGIN.left + (i + 0.5) * band} y={height - 8} textAnchor="middle" fontSize={11} style={{ fill: 'var(--muted)' }}>
                      {c}
                    </text>
                  )}
                  {/* Zone de survol plus large que les barres: bande entière, atteignable au clavier. */}
                  <rect
                    x={MARGIN.left + i * band}
                    y={MARGIN.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${tooltipTitles?.[i] ?? c}: ${series.map((s) => `${s.label} ${format(s.values[i])}`).join(', ')}`}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    style={{ outline: 'none' }}
                  />
                </g>
              )
            })}
          </svg>
        )}
        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-md"
            style={{ left: tipLeft, top: 0 }}
          >
            <p className="mb-1 font-medium">{tooltipTitles?.[hover] ?? categories[hover]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                <span className="font-semibold tabular-nums">{format(s.values[hover])}</span>
                <span className="text-muted">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <figcaption className="flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <details className="no-print text-xs text-muted">
        <summary className="cursor-pointer">{t('viewTableData')}</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-medium" />
              {series.map((s) => (
                <th key={s.key} className="py-1 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={`${c}-${i}`} className="border-t border-border">
                <th className="py-1 font-normal">{tooltipTitles?.[i] ?? c}</th>
                {series.map((s) => (
                  <td key={s.key} className="py-1 text-right tabular-nums">
                    {format(s.values[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
