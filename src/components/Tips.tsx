import { Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Tip } from '../lib/tips'

export default function Tips({ tips, title }: { tips: Tip[]; title?: string }) {
  const { t } = useTranslation()
  if (tips.length === 0) return null
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em]">
        <Lightbulb aria-hidden size={16} className="text-accent-strong" />
        {title ?? t('tipsTitle')}
      </h2>
      <ul className="flex flex-col divide-y divide-dashed divide-muted/30 text-sm">
        {tips.map((tip, i) => (
          <li key={`${tip.key}-${i}`} className="flex gap-2 py-2">
            <span aria-hidden className="text-accent-strong">•</span>
            <span>{t(tip.key, tip.params)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
