import { Check, Gauge, Lightbulb, PartyPopper, Sprout, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Advice, AdviceAction, Tone } from '../lib/advice'
import { useOptionalProfile } from '../lib/profile'
import Card from './ui/Card'

const TONE: Record<Tone, { icon: typeof Check; color: string }> = {
  win: { icon: PartyPopper, color: 'var(--ok-ink)' },
  heads: { icon: Gauge, color: 'var(--accent-strong)' },
  idea: { icon: Lightbulb, color: 'var(--chart-2)' },
  info: { icon: Sprout, color: 'var(--muted)' },
}

interface Props {
  advice: Advice[]
  hide: (a: Advice) => void
  apply: (action: AdviceAction) => Promise<string | null>
}

function greetingKey(hour: number) {
  if (hour < 5) return 'companionNight'
  if (hour < 12) return 'companionMorning'
  if (hour < 18) return 'companionAfternoon'
  return 'companionEvening'
}

// Une ligne de conseil: pastille selon le ton, texte, action en un geste et « masquer ».
function AdviceItem({ advice, hide, apply }: { advice: Advice } & Omit<Props, 'advice'>) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const { icon: Icon, color } = TONE[advice.tone]

  async function run() {
    if (!advice.action) return
    setState('busy')
    const e = await apply(advice.action)
    setError(e)
    setState(e ? 'idle' : 'done')
  }

  return (
    <li className="flex gap-3 py-3.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full"
        style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
      >
        <Icon size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm leading-relaxed">{t(advice.key, advice.params)}</p>
          {state !== 'done' && (
            <button
              type="button"
              onClick={() => hide(advice)}
              aria-label={advice.lasting ? t('adv_hideForever') : t('adv_hide')}
              title={advice.lasting ? t('adv_hideForever') : t('adv_hide')}
              className="-mr-1.5 -mt-1 grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-accent-soft"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {state === 'done' ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-ok-ink">
            <Check size={14} strokeWidth={2.6} /> {t('adv_done')}
          </p>
        ) : (
          advice.action &&
          advice.actionKey && (
            <div>
              <button
                type="button"
                disabled={state === 'busy'}
                onClick={() => void run()}
                className="rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent-strong"
              >
                {t(advice.actionKey, advice.actionParams)}
              </button>
            </div>
          )
        )}
        {error && <p className="text-xs text-over">{error}</p>}
      </div>
    </li>
  )
}

/** Liste simple (dans le détail d'une enveloppe). */
export function AdviceList({ advice, hide, apply }: Props) {
  const { t } = useTranslation()
  if (advice.length === 0) return null
  return (
    <Card title={t('companionShort')}>
      <ul className="-my-3.5 divide-y divide-dashed divide-muted/30">
        {advice.map((a) => (
          <AdviceItem key={a.id} advice={a} hide={hide} apply={apply} />
        ))}
      </ul>
    </Card>
  )
}

// Le compagnon de l'accueil: une petite fleur qui salue, résume le mois et propose quelques idées.
export default function Companion({ advice, hide, apply }: Props) {
  const { t } = useTranslation()
  const profile = useOptionalProfile()
  const [expanded, setExpanded] = useState(false)
  const name = profile?.profile.firstName
  const ideas = advice.filter((a) => a.tone !== 'win')
  const summary =
    advice.length === 0 ? t('companionCalm') : ideas.length === 0 ? t('companionWins') : t('companionCount', { count: ideas.length })
  const shown = expanded ? advice : advice.slice(0, 3)

  return (
    <Card>
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-11 shrink-0 rounded-2xl shadow-sm" />
        <div className="min-w-0">
          <p className="text-[15px] font-medium">
            {t(greetingKey(new Date().getHours()))}
            {name ? ` ${name}` : ''} !
          </p>
          <p className="text-sm text-muted">{summary}</p>
        </div>
      </div>
      {shown.length > 0 && (
        <ul className="mt-2 -mb-3.5 divide-y divide-dashed divide-muted/30">
          {shown.map((a) => (
            <AdviceItem key={a.id} advice={a} hide={hide} apply={apply} />
          ))}
        </ul>
      )}
      {advice.length > 3 && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-4 text-sm font-medium text-accent-strong underline-offset-4 hover:underline">
          {expanded ? t('companionLess') : t('companionMore', { count: advice.length - 3 })}
        </button>
      )}
    </Card>
  )
}
