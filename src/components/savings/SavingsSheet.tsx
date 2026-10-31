import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseAmount } from '../../lib/format'
import type { SavingsEnvelope } from '../../lib/savings'
import { supabase } from '../../lib/supabase'
import ConfirmButton from '../ConfirmButton'
import IconPicker from '../IconPicker'
import Field, { PRIMARY } from '../ui/Field'
import Sheet from '../ui/Sheet'

// Création ou modification d'une enveloppe d'épargne (ou d'une sous-enveloppe si parentId est donné).
export default function SavingsSheet({
  householdId,
  envelope,
  parentId,
  defaultColor,
  sort,
  hasChildren,
  onClose,
  onSaved,
  onDeleted,
}: {
  householdId: string
  envelope?: SavingsEnvelope
  parentId?: string
  defaultColor: string
  sort: number
  hasChildren?: boolean
  onClose: () => void
  onSaved: () => void
  onDeleted?: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(envelope?.name ?? '')
  const [target, setTarget] = useState(envelope?.target == null ? '' : String(envelope.target).replace('.', ','))
  const [look, setLook] = useState({ icon: envelope?.icon ?? 'piggy', color: envelope?.color ?? defaultColor })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const goal = target.trim() === '' ? null : parseAmount(target)
    if (!name.trim()) return setError(t('errNameRequired'))
    if (goal !== null && !(goal > 0)) return setError(t('errAmount'))
    setBusy(true)
    const values = { name: name.trim(), target: goal, icon: look.icon, color: look.color }
    const { error } = envelope
      ? await supabase.from('savings_envelopes').update(values).eq('id', envelope.id)
      : await supabase.from('savings_envelopes').insert({ ...values, household_id: householdId, parent_id: parentId ?? null, sort })
    setBusy(false)
    if (error) return setError(/icon|color/.test(error.message) ? t('errMigration0006') : `${t('errSave')} (${error.message})`)
    onSaved()
    onClose()
  }

  async function remove() {
    if (!envelope) return
    const { error } = await supabase.from('savings_envelopes').delete().eq('id', envelope.id)
    if (error) return setError(`${t('errSave')} (${error.message})`)
    onDeleted?.()
    onClose()
  }

  const title = envelope ? t('editSavings') : parentId ? t('addSubEnvelope') : t('addSavings')

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={t('envelopeNameLabel')}>
          <input autoFocus={!envelope} placeholder={t('savingsName')} value={name} onChange={(e) => setName(e.target.value)} className="field-line text-lg" />
        </Field>
        <Field label={t('savingsTargetOptional')}>
          <input inputMode="decimal" placeholder="0,00" value={target} onChange={(e) => setTarget(e.target.value)} className="field-line text-lg tabular-nums" />
        </Field>
        <IconPicker icon={look.icon} color={look.color} onChange={(n) => setLook({ icon: n.icon ?? 'piggy', color: n.color ?? defaultColor })} />
        {error && <p className="text-sm text-over">{error}</p>}
        <button disabled={busy} className={PRIMARY}>
          {envelope ? t('save') : title}
        </button>
        {envelope && (
          <ConfirmButton
            label={t('deleteSavings')}
            confirmLabel={hasChildren ? `${t('deleteSavingsHint')} ${t('confirmDelete')}` : t('confirmDelete')}
            onConfirm={() => void remove()}
            className="self-center text-sm text-muted underline"
            confirmClassName="self-center text-sm font-semibold text-over underline"
          />
        )}
      </form>
    </Sheet>
  )
}
