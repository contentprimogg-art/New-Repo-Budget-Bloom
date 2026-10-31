import { Check, House } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createHousehold, joinHousehold, useHouseholds } from '../lib/households'
import Card from './ui/Card'
import { SECONDARY } from './ui/Field'
import Sheet from './ui/Sheet'

// Liste des foyers dont on est membre: un appui affiche ce foyer.
function HouseholdList({ onPicked }: { onPicked?: () => void }) {
  const { t } = useTranslation()
  const households = useHouseholds()
  if (!households) return null
  return (
    <ul role="radiogroup" aria-label={t('myHouseholds')} className="-my-1 divide-y divide-dashed divide-muted/30">
      {households.list.map((h) => {
        const active = h.id === households.activeId
        return (
          <li key={h.id}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                onPicked?.()
                if (!active) void households.switchTo(h.id)
              }}
              className="flex w-full items-center gap-3 py-3 text-left"
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-full ${active ? 'bg-accent-strong text-on-accent' : 'bg-accent-soft text-accent-strong'}`}>
                <House size={17} />
              </span>
              <span className={`min-w-0 flex-1 truncate text-[15px] ${active ? 'font-medium' : ''}`}>{h.name}</span>
              {active && <Check size={18} className="shrink-0 text-accent-strong" strokeWidth={2.6} />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Petite pastille au-dessus du budget quand on a plusieurs foyers: ouvre le choix du foyer. */
export function HouseholdChip() {
  const { t } = useTranslation()
  const households = useHouseholds()
  const [open, setOpen] = useState(false)
  if (!households || households.list.length < 2) return null
  const current = households.list.find((h) => h.id === households.activeId)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print mt-1 flex max-w-full items-center gap-1.5 text-sm text-muted hover:text-text"
        aria-label={t('switchHousehold')}
      >
        <House size={14} className="shrink-0" />
        <span className="truncate underline decoration-dotted underline-offset-4">{current?.name}</span>
      </button>
      {open && (
        <Sheet title={t('switchHousehold')} onClose={() => setOpen(false)}>
          <HouseholdList onPicked={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  )
}

// Carte du profil: mes foyers, en créer un autre ou en rejoindre un avec un code d'invitation.
export default function HouseholdsCard() {
  const { t } = useTranslation()
  const households = useHouseholds()
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!households) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = value.trim()
    if (!text) return setError(mode === 'create' ? t('errNameRequired') : t('errCodeRequired'))
    setBusy(true)
    const result = mode === 'create' ? await createHousehold(text) : await joinHousehold(text)
    setBusy(false)
    if (result.error || !result.id) return setError(mode === 'create' ? t('errGeneric') : t('errBadCode'))
    setMode(null)
    setValue('')
    setError(null)
    await households!.switchTo(result.id)
  }

  return (
    <Card title={t('myHouseholds')} description={t('myHouseholdsHint')}>
      <div className="flex flex-col gap-4">
        <HouseholdList />
        {mode ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            <input
              autoFocus
              className="field-line"
              placeholder={mode === 'create' ? t('householdName') : t('inviteCode')}
              aria-label={mode === 'create' ? t('householdName') : t('inviteCode')}
              aria-invalid={!!error}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {error && <p className="text-sm text-over">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} className={SECONDARY}>
                {mode === 'create' ? t('createHousehold') : t('joinHousehold')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode(null)
                  setError(null)
                }}
                className="px-3 text-sm text-muted underline"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setMode('create')} className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-accent">
              {t('newHousehold')}
            </button>
            <button type="button" onClick={() => setMode('join')} className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-accent">
              {t('joinWithCode')}
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
