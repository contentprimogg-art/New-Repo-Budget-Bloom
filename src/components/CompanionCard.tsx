import { Check } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TOPICS } from '../lib/advice'
import { resetHidden, useCompanionSettings, writeCompanion } from '../lib/useAdvice'
import Card from './ui/Card'

// Réglages du compagnon: l'afficher ou non, et choisir les sujets de conseils.
export default function CompanionCard() {
  const { t } = useTranslation()
  const settings = useCompanionSettings()
  const [reset, setReset] = useState(false)

  const toggleTopic = (topic: (typeof TOPICS)[number]) =>
    writeCompanion({
      ...settings,
      off: settings.off.includes(topic) ? settings.off.filter((x) => x !== topic) : [...settings.off, topic],
    })

  return (
    <Card title={t('companionSettings')} description={t('companionSettingsHint')}>
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-[15px]">{t('companionEnabled')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => writeCompanion({ ...settings, enabled: !settings.enabled })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings.enabled ? 'bg-accent-strong' : 'bg-track'}`}
          >
            <span
              className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${settings.enabled ? 'left-6' : 'left-1'}`}
            />
          </button>
        </label>
        {settings.enabled && (
          <>
            <div>
              <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">{t('companionTopics')}</p>
              <ul className="flex flex-col">
                {TOPICS.map((topic) => {
                  const on = !settings.off.includes(topic)
                  return (
                    <li key={topic}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggleTopic(topic)}
                        className="flex w-full items-center gap-3 py-2 text-left text-sm"
                      >
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-accent-strong bg-accent-strong text-on-accent' : 'border-border'}`}
                        >
                          {on && <Check size={13} strokeWidth={3} />}
                        </span>
                        {t(`topic_${topic}`)}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => {
                resetHidden()
                setReset(true)
              }}
              className="self-start text-sm text-muted underline"
            >
              {reset ? t('companionResetDone') : t('companionReset')}
            </button>
          </>
        )}
      </div>
    </Card>
  )
}
