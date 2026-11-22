import { useTranslation } from 'react-i18next'

// Silhouette de page, uniquement à la toute première ouverture: jamais de faux montants à zéro.
export default function PageSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('loading')} className="flex animate-pulse flex-col gap-4">
      <div className="h-32 rounded-3xl bg-track" />
      <div className="flex flex-col gap-4 rounded-3xl border border-border/80 bg-surface p-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-track" />
            <div className="h-3 flex-1 rounded-full bg-track" />
            <div className="h-3 w-16 rounded-full bg-track" />
          </div>
        ))}
      </div>
    </div>
  )
}
