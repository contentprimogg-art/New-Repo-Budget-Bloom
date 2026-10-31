import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CURRENCIES, currencyName, fmtMoney, parseAmount } from '../lib/format'
import { fmtRate, getRate } from '../lib/fx'
import { useHousehold } from '../lib/household'
import { useHouseholds } from '../lib/households'
import { supabase } from '../lib/supabase'
import ConfirmButton from './ConfirmButton'
import InviteCode from './InviteCode'
import Select from './Select'
import { MemberAvatar } from './ui/AvatarStack'
import Card from './ui/Card'
import Field, { SECONDARY } from './ui/Field'

// Foyer affiché: nom, membres (photo et nom), code d'invitation, devise, quitter le foyer.
export default function HouseholdCard({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation()
  const household = useHousehold()
  const households = useHouseholds()
  const [name, setName] = useState(household.name)
  const [nextCurrency, setNextCurrency] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const alone = household.members.length <= 1

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(household.name)
  }, [household.name])

  async function saveName() {
    const next = name.trim()
    if (!next || next === household.name) return setName(household.name)
    const e = await household.rename(next)
    if (e) return setError(`${t('errSave')} (${e})`)
    await households?.refresh()
  }

  async function leave() {
    const { error } = await supabase.from('household_members').delete().eq('household_id', household.id).eq('user_id', userId)
    if (error) return setError(`${t('errSave')} (${error.message})`)
    window.location.hash = ''
    window.location.reload()
  }

  return (
    <Card title={t('household')} description={t('inviteHint')}>
      <div className="flex flex-col gap-5">
        <Field label={t('householdName')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="field-line"
          />
        </Field>
        <ul className="flex flex-col gap-2.5">
          {household.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <MemberAvatar member={m} size={34} />
              <span className="text-[15px]">
                {m.name}
                {m.isMe && <span className="ml-1.5 text-xs text-muted">({t('you')})</span>}
              </span>
            </li>
          ))}
        </ul>
        <InviteCode householdId={household.id} />
        <Field label={t('currency')}>
          <Select
            variant="field"
            label={t('currency')}
            value={nextCurrency ?? household.currency}
            options={CURRENCIES.map((c) => ({ value: c, label: `${c} · ${currencyName(c, i18n.language)}` }))}
            onChange={(code) => setNextCurrency(code === household.currency ? null : code)}
          />
        </Field>
        {nextCurrency && (
          <CurrencyChange
            key={nextCurrency}
            from={household.currency}
            to={nextCurrency}
            onDone={(e) => {
              setNextCurrency(null)
              setError(e)
            }}
          />
        )}
        {error && <p className="text-sm text-over">{error}</p>}
        <ConfirmButton
          label={t('leaveHousehold')}
          confirmLabel={alone ? t('leaveHouseholdLast') : t('leaveHouseholdConfirm')}
          onConfirm={() => void leave()}
          className="self-start text-sm text-muted underline"
          confirmClassName="self-start text-left text-sm font-semibold text-over underline"
        />
      </div>
    </Card>
  )
}

// Changement de devise: convertir tous les montants au taux du jour (modifiable), ou ne changer que le symbole.
function CurrencyChange({ from, to, onDone }: { from: string; to: string; onDone: (error: string | null) => void }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const household = useHousehold()
  const [rate, setRate] = useState('')
  const [rateDate, setRateDate] = useState<string | null>(null)
  const [looking, setLooking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void getRate(from, to).then((r) => {
      if (!alive) return
      setLooking(false)
      if (r) {
        setRate(fmtRate(r.rate, i18n.language))
        setRateDate(r.date || null)
      }
    })
    return () => {
      alive = false
    }
  }, [from, to, i18n.language])

  const value = parseAmount(rate)
  const valid = Number.isFinite(value) && value > 0

  async function convert() {
    if (!valid) return setLocalError(t('errRate'))
    setBusy(true)
    const e = await household.convertCurrency(to, value)
    setBusy(false)
    if (e) return setLocalError(/convert_household/.test(e) ? t('errMigration0009') : `${t('errSave')} (${e})`)
    onDone(null)
  }

  async function symbolOnly() {
    setBusy(true)
    const e = await household.changeCurrency(to)
    setBusy(false)
    onDone(e ? `${t('errSave')} (${e})` : null)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-accent-soft/50 p-4">
      <p className="text-sm font-medium">{t('currencyChangeTitle', { from, to })}</p>
      <label className="flex flex-wrap items-baseline gap-2 text-sm">
        <span>1 {from} =</span>
        <input
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder={looking ? '…' : '0,00'}
          aria-label={t('exchangeRate')}
          className="field-line w-28 text-right tabular-nums"
        />
        <span>{to}</span>
      </label>
      <p className="text-xs text-muted">
        {looking
          ? t('rateLooking')
          : valid
            ? `${rateDate ? t('rateSource', { date: rateDate }) + ' · ' : ''}${fmtMoney(100, lng, from)} → ${fmtMoney(Math.round(100 * value * 100) / 100, lng, to)}`
            : t('rateMissing')}
      </p>
      <p className="text-xs text-muted">{t('convertHint')}</p>
      {localError && <p className="text-sm text-over">{localError}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !valid} onClick={() => void convert()} className={`${SECONDARY} bg-accent-strong! text-on-accent! disabled:opacity-50`}>
          {t('convertAll')}
        </button>
        <button type="button" disabled={busy} onClick={() => void symbolOnly()} className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-accent">
          {t('symbolOnly')}
        </button>
        <button type="button" disabled={busy} onClick={() => onDone(null)} className="px-2 text-sm text-muted underline">
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
