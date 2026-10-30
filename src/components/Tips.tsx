import { useTranslation } from 'react-i18next'
import type { Tip } from '../lib/tips'

export default function Tips({ tips, title }: { tips: Tip[]; title?: string }) {
  const { t } = useTranslation()
  if (tips.length === 0) return null
  return (
    <section className="rounded-2xl bg-accent-soft/60 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
        <span aria-hidden>💡</span>
        {title ?? t('tipsTitle')}
      </h2>
      <ul className="flex flex-col gap-2 text-sm">
        {tips.map((tip, i) => (
          <li key={`${tip.key}-${i}`} className="flex gap-2">
            <span aria-hidden className="text-accent-strong">•</span>
            <span>{t(tip.key, tip.params)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
