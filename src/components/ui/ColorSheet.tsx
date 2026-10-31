import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { hexToHsl, hslToHex } from '../../lib/color'
import { contrast, isHex } from '../../lib/theme'
import Field, { PRIMARY } from './Field'
import Sheet from './Sheet'

const SUGGESTED = [
  '#E46A9E', '#C2185B', '#D9714A', '#E0A23A', '#9C7A3C', '#3B9A6C',
  '#2E8B87', '#4472C4', '#5C6BC0', '#8B6FD1', '#A05195', '#5F6B7A',
]

// Sélecteur de couleur aux couleurs de l'app (remplace celui du système):
// teinte, intensité et luminosité en curseurs, aperçu, code hexadécimal et suggestions.
export default function ColorSheet({
  title,
  value,
  suggestions = SUGGESTED,
  onClose,
  onPick,
}: {
  title: string
  value: string
  suggestions?: string[]
  onClose: () => void
  onPick: (hex: string) => void
}) {
  const { t } = useTranslation()
  const [hsl, setHsl] = useState(() => hexToHsl(isHex(value) ? value : SUGGESTED[0]))
  const [text, setText] = useState(isHex(value) ? value.toUpperCase() : SUGGESTED[0])
  const [h, s, l] = hsl
  const hex = hslToHex(h, s, l)

  const set = (next: [number, number, number]) => {
    setHsl(next)
    setText(hslToHex(...next))
  }

  const tracks = {
    hue: `linear-gradient(90deg, ${[0, 60, 120, 180, 240, 300, 360].map((x) => hslToHex(x, Math.max(s, 55), 55)).join(',')})`,
    sat: `linear-gradient(90deg, ${hslToHex(h, 0, l)}, ${hslToHex(h, 100, l)})`,
    light: `linear-gradient(90deg, ${hslToHex(h, s, 12)}, ${hslToHex(h, s, 50)}, ${hslToHex(h, s, 92)})`,
  }
  const onAccent = contrast('#ffffff', hex) >= 3 ? '#ffffff' : '#1a1d20'

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="flex items-center gap-4">
        <span className="size-16 shrink-0 rounded-full shadow-inner" style={{ background: hex }} />
        <div className="flex flex-1 flex-col gap-2">
          <span className="w-fit rounded-full px-4 py-1.5 text-sm font-semibold" style={{ background: hex, color: onAccent }}>
            {t('preview')}
          </span>
          <Field label={t('hexCode')}>
            <input
              value={text}
              maxLength={7}
              onChange={(e) => {
                const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                setText(v.toUpperCase())
                if (isHex(v)) setHsl(hexToHsl(v))
              }}
              className="field-line font-mono text-sm uppercase"
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Slider label={t('hue')} value={h} max={360} track={tracks.hue} onChange={(v) => set([v, s, l])} />
        <Slider label={t('intensity')} value={s} max={100} track={tracks.sat} onChange={(v) => set([h, v, l])} />
        <Slider label={t('lightness')} value={l} max={100} track={tracks.light} onChange={(v) => set([h, s, v])} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">{t('suggestions')}</span>
        <div className="flex flex-wrap gap-2.5">
          {suggestions.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={c.toUpperCase() === hex}
              onClick={() => set(hexToHsl(c))}
              className={`size-9 rounded-full ${c.toUpperCase() === hex ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <button
        className={PRIMARY}
        onClick={() => {
          onPick(hex)
          onClose()
        }}
      >
        {t('apply')}
      </button>
    </Sheet>
  )
}

function Slider({ label, value, max, track, onChange }: { label: string; value: number; max: number; track: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>
      <input type="range" min={0} max={max} value={value} onChange={(e) => onChange(+e.target.value)} className="range-pretty" style={{ background: track }} />
    </label>
  )
}
