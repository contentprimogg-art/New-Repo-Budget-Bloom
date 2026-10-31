import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CURRENCIES, currencyName } from '../lib/format'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import ConfirmButton from './ConfirmButton'
import InviteCode from './InviteCode'
import Select from './Select'
import { MemberAvatar } from './ui/AvatarStack'
import Card from './ui/Card'
import Field from './ui/Field'

// Foyer: membres (photo et nom), code d'invitation, devise, quitter le foyer.
export default function HouseholdCard({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation()
  const household = useHousehold()
  const [error, setError] = useState<string | null>(null)
  const alone = household.members.length <= 1

  async function leave() {
    const { error } = await supabase.from('household_members').delete().eq('household_id', household.id).eq('user_id', userId)
    if (error) return setError(`${t('errSave')} (${error.message})`)
    window.location.hash = ''
    window.location.reload()
  }

  return (
    <Card title={t('household')} description={t('inviteHint')}>
      <div className="flex flex-col gap-5">
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
            value={household.currency}
            options={CURRENCIES.map((c) => ({ value: c, label: `${c} · ${currencyName(c, i18n.language)}` }))}
            onChange={(code) => void household.changeCurrency(code).then((e) => setError(e ? `${t('errSave')} (${e})` : null))}
          />
        </Field>
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
