import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { EnvelopeGroup } from '../../lib/types'
import Field, { PRIMARY } from '../ui/Field'
import Sheet from '../ui/Sheet'

// Création ou renommage d'un groupe d'enveloppes.
export default function GroupSheet({
  householdId,
  group,
  sort,
  onClose,
  onSaved,
}: {
  householdId: string
  group?: EnvelopeGroup
  sort: number
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(group?.name ?? '')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError(t('errNameRequired'))
    const { error } = group
      ? await supabase.from('envelope_groups').update({ name: name.trim() }).eq('id', group.id)
      : await supabase.from('envelope_groups').insert({ household_id: householdId, name: name.trim(), sort })
    if (error) {
      return setError(/envelope_groups/.test(error.message) ? t('errMigrationGroups') : `${t('errSave')} (${error.message})`)
    }
    onSaved()
    onClose()
  }

  return (
    <Sheet title={group ? t('renameGroup') : t('newGroup')} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={t('groupName')} error={error} hint={group ? undefined : t('groupHint')}>
          <input
            autoFocus
            placeholder={t('groupPlaceholder')}
            aria-invalid={!!error}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-line text-lg"
          />
        </Field>
        <button className={PRIMARY}>{group ? t('save') : t('createGroup')}</button>
      </form>
    </Sheet>
  )
}
