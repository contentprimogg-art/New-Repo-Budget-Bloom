import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PASTELS, emojiTints, hexToHsl } from '../lib/color'
import { BADGE_COLORS, IconBadge, IconGlyph, ICON_KEYS, badgeColor, isEmoji } from '../lib/icons'
import ColorSheet from './ui/ColorSheet'

type Catalog = { groups: { id: number; fr: string; en: string }[]; list: [string, number, string, string, string][] }

// Emoji représentatif de chaque catégorie (onglets du catalogue).
const GROUP_ICON: Record<number, string> = { 0: '😀', 1: '👋', 3: '🐻', 4: '🍔', 5: '✈️', 6: '⚽', 7: '💡', 8: '❤️', 9: '🏳️' }
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const isLight = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex) && hexToHsl(hex)[2] > 80

// Choix de l'icône d'une enveloppe: tout le catalogue d'emojis (recherche en français) ou des icônes
// au trait, puis la couleur de fond (teintes assorties à l'emoji, palette, ou couleur libre).
export default function IconPicker({
  icon,
  color,
  onChange,
}: {
  icon: string | null
  color: string | null
  onChange: (next: { icon: string | null; color: string | null }) => void
}) {
  const { t } = useTranslation()
  const emoji = isEmoji(icon)
  const [tab, setTab] = useState<'emoji' | 'icons'>(icon && !emoji ? 'icons' : 'emoji')
  const [custom, setCustom] = useState(false)
  const current = badgeColor(color ?? BADGE_COLORS[0])
  const tints = emoji ? emojiTints(icon) : []
  const swatches = emoji ? [...tints, ...PASTELS] : BADGE_COLORS

  const pickEmoji = (e: string) => onChange({ icon: e, color: emojiTints(e)[0] })
  const pickIcon = (key: string) => onChange({ icon: key, color: color && !isLight(color) ? color : BADGE_COLORS[0] })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} color={current} size="lg" />
        <div role="tablist" aria-label={t('chooseIcon')} className="flex rounded-full border border-border p-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
          {(['emoji', 'icons'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`rounded-full px-3.5 py-1.5 ${tab === k ? 'bg-accent-soft text-accent-strong' : 'text-muted'}`}
            >
              {k === 'emoji' ? t('emojis') : t('lineIcons')}
            </button>
          ))}
        </div>
      </div>

      {tab === 'emoji' ? (
        <EmojiCatalog selected={icon} onPick={pickEmoji} />
      ) : (
        <div role="group" aria-label={t('lineIcons')} className="grid grid-cols-7 gap-1 sm:grid-cols-9">
          {ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={icon === key}
              aria-label={key}
              onClick={() => pickIcon(key)}
              className={`grid aspect-square place-items-center rounded-2xl ${icon === key ? 'bg-accent-soft ring-2 ring-accent-strong' : 'hover:bg-accent-soft/60'}`}
            >
              <IconGlyph icon={key} color={icon === key ? current : 'var(--muted)'} size={21} />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
          {emoji ? t('matchingTints') : t('chooseColor')}
        </span>
        <div role="group" aria-label={t('chooseColor')} className="flex flex-wrap gap-2.5">
          {swatches.map((c, n) => (
            <button
              key={`${c}-${n}`}
              type="button"
              aria-pressed={current.toUpperCase() === c.toUpperCase()}
              aria-label={`${t('chooseColor')} ${n + 1}`}
              onClick={() => onChange({ icon, color: c })}
              className={`size-8 rounded-full border border-black/5 ${current.toUpperCase() === c.toUpperCase() ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''} ${emoji && n === tints.length - 1 ? 'mr-2' : ''}`}
              style={{ background: c }}
            />
          ))}
          <button
            type="button"
            onClick={() => setCustom(true)}
            className="h-8 rounded-full border border-dashed border-muted/60 px-3 text-xs text-muted hover:border-accent hover:text-accent-strong"
          >
            {t('customColor')}
          </button>
        </div>
      </div>

      {custom && (
        <ColorSheet
          title={t('chooseColor')}
          value={current.startsWith('#') ? current : BADGE_COLORS[0]}
          suggestions={emoji ? [...tints, ...PASTELS] : undefined}
          onClose={() => setCustom(false)}
          onPick={(hex) => onChange({ icon, color: hex })}
        />
      )}
    </div>
  )
}

function EmojiCatalog({ selected, onPick }: { selected: string | null; onPick: (emoji: string) => void }) {
  const { t, i18n } = useTranslation()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState(7)

  useEffect(() => {
    // Le catalogue (≈ 1 900 emojis) n'est chargé qu'à l'ouverture du sélecteur.
    void import('../data/emojis.json').then((m) => setCatalog(m.default as Catalog))
  }, [])

  const results = useMemo(() => {
    if (!catalog) return []
    const words = normalize(query).split(/\s+/).filter(Boolean)
    if (words.length === 0) return catalog.list.filter((e) => e[1] === group)
    return catalog.list
      .filter((e) => {
        const haystack = normalize(`${e[2]} ${e[3]} ${e[4]}`)
        return words.every((w) => haystack.includes(w))
      })
      .slice(0, 200)
  }, [catalog, query, group])

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 border-b-[1.5px] border-dashed border-muted/45 pb-1.5 focus-within:border-solid focus-within:border-accent-strong">
        <Search size={16} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchEmoji')}
          aria-label={t('searchEmoji')}
          className="w-full border-0 bg-transparent text-sm outline-none focus:shadow-none"
        />
      </label>
      {!query && catalog && (
        <div role="tablist" aria-label={t('emojis')} className="-m-1 flex gap-1 overflow-x-auto p-1">
          {catalog.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={group === g.id}
              aria-label={i18n.language.startsWith('fr') ? g.fr : g.en}
              title={i18n.language.startsWith('fr') ? g.fr : g.en}
              onClick={() => setGroup(g.id)}
              className={`emoji grid size-9 shrink-0 place-items-center rounded-full text-lg ${group === g.id ? 'bg-accent-soft ring-1 ring-accent' : 'opacity-60 hover:opacity-100'}`}
            >
              {GROUP_ICON[g.id]}
            </button>
          ))}
        </div>
      )}
      <div className="-m-1 grid max-h-61 grid-cols-8 gap-0.5 overflow-y-auto overscroll-contain p-1">
        {!catalog && <p className="col-span-8 py-6 text-center text-sm text-muted">{t('loading')}</p>}
        {catalog && results.length === 0 && <p className="col-span-8 py-6 text-center text-sm text-muted">{t('noEmojiFound')}</p>}
        {results.map(([e, , fr, , en]) => (
          <button
            key={e}
            type="button"
            aria-pressed={selected === e}
            aria-label={i18n.language.startsWith('fr') ? fr : en.split(' ')[0]}
            title={i18n.language.startsWith('fr') ? fr : undefined}
            onClick={() => onPick(e)}
            className={`emoji grid aspect-square place-items-center rounded-xl text-[26px] ${selected === e ? 'bg-accent-soft ring-2 ring-accent-strong' : 'hover:bg-accent-soft/60'}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
