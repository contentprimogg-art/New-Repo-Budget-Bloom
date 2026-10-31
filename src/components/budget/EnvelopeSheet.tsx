import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { emojiTints } from '../../lib/color'
import { parseAmount } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Envelope, EnvelopeGroup } from '../../lib/types'
import ConfirmButton from '../ConfirmButton'
import IconPicker from '../IconPicker'
import Select from '../Select'
import Field, { PRIMARY } from '../ui/Field'
import Sheet from '../ui/Sheet'

const NO_GROUP = '__none__'

// Création ou modification d'une enveloppe: nom, budget, groupe, icône, couleur, récurrence.
export default function EnvelopeSheet({
  householdId,
  month,
  envelope,
  groups,
  defaultGroupId,
  defaultColor,
  sort,
  onClose,
  onSaved,
  onDeleted,
}: {
  householdId: string
  month: string
  envelope?: Envelope
  groups: EnvelopeGroup[]
  defaultGroupId?: string | null
  defaultColor: string
  sort: number
  onClose: () => void
  onSaved: () => void
  onDeleted?: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(envelope?.name ?? '')
  const [budget, setBudget] = useState(envelope ? String(envelope.budget).replace('.', ',') : '')
  const [group, setGroup] = useState(envelope?.group_id ?? defaultGroupId ?? NO_GROUP)
  const [recurring, setRecurring] = useState(envelope?.recurring ?? true)
  const [look, setLook] = useState(() =>
    envelope ? { icon: envelope.icon ?? 'cart', color: envelope.color ?? defaultColor } : { icon: '🛒', color: emojiTints('🛒')[0] },
  )
  const [errors, setErrors] = useState<{ name?: string; budget?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const value = parseAmount(budget)
    const found: typeof errors = {}
    if (!name.trim()) found.name = t('errNameRequired')
    if (!(value >= 0) || budget.trim() === '') found.budget = t('errAmount')
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    const values = {
      name: name.trim(),
      budget: value,
      recurring,
      icon: look.icon,
      color: look.color,
      group_id: group === NO_GROUP ? null : group,
    }
    const { error } = envelope
      ? await supabase.from('envelopes').update(values).eq('id', envelope.id)
      : await supabase.from('envelopes').insert({ ...values, household_id: householdId, month, sort })
    setBusy(false)
    if (error) return setErrors({ form: `${t('errSave')} (${error.message})` })
    onSaved()
    onClose()
  }

  async function remove() {
    if (!envelope) return
    const { error } = await supabase.from('envelopes').delete().eq('id', envelope.id)
    if (error) return setErrors({ form: `${t('errSave')} (${error.message})` })
    onDeleted?.()
    onClose()
  }

  return (
    <Sheet title={envelope ? t('editEnvelope') : t('newEnvelope')} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={t('envelopeNameLabel')} error={errors.name}>
          <input
            autoFocus={!envelope}
            placeholder={t('envelopeName')}
            aria-invalid={!!errors.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-line text-lg"
          />
        </Field>
        <Field label={t('envelopeBudget')} error={errors.budget}>
          <input
            inputMode="decimal"
            placeholder="0,00"
            aria-invalid={!!errors.budget}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="field-line text-lg tabular-nums"
          />
        </Field>
        {groups.length > 0 && (
          <Field label={t('group')}>
            <Select
              variant="field"
              label={t('group')}
              value={group}
              options={[{ value: NO_GROUP, label: t('noGroup') }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
              onChange={setGroup}
            />
          </Field>
        )}
        <IconPicker icon={look.icon} color={look.color} onChange={(next) => setLook({ icon: next.icon ?? 'cart', color: next.color ?? defaultColor })} />
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="size-4" />
          {t('recurringLabel')}
        </label>
        {errors.form && <p className="text-sm text-over">{errors.form}</p>}
        <button disabled={busy} className={PRIMARY}>
          {envelope ? t('save') : t('addEnvelope')}
        </button>
        {envelope && (
          <ConfirmButton
            label={t('deleteEnvelope')}
            confirmLabel={`${t('deleteEnvelopeHint')} ${t('confirmDelete')}`}
            onConfirm={() => void remove()}
            className="self-center text-sm text-muted underline"
            confirmClassName="self-center text-sm font-semibold text-over underline"
          />
        )}
      </form>
    </Sheet>
  )
}
