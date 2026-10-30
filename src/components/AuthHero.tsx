import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Garden from './Garden'

const SLIDES = [
  { stage: 1 as const, a: 'authSlide1a', b: 'authSlide1b' },
  { stage: 2 as const, a: 'authSlide2a', b: 'authSlide2b' },
  { stage: 3 as const, a: 'authSlide3a', b: 'authSlide3b' },
]

// Carrousel d'accueil façon appli bancaire: grande carte arrondie, bandeaux blancs en capitales, points de pagination.
export default function AuthHero() {
  const { t } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const touched = useRef(false)
  const [index, setIndex] = useState(0)

  const go = (i: number) => {
    const el = scroller.current
    el?.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  // Défilement automatique doux, arrêté dès que la personne touche au carrousel ou préfère moins d'animations.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => {
      const el = scroller.current
      if (!el || touched.current) return
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % SLIDES.length
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full overflow-hidden rounded-4xl shadow-lg shadow-accent/20">
        <div
          ref={scroller}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          onPointerDown={() => (touched.current = true)}
          className="flex aspect-5/4 snap-x snap-mandatory overflow-x-auto scrollbar-none md:aspect-4/5 [&::-webkit-scrollbar]:hidden"
        >
          {SLIDES.map((s, i) => (
            <div key={s.stage} className="relative size-full shrink-0 snap-center" aria-hidden={i !== index}>
              <Garden stage={s.stage} />
              <div className="absolute bottom-5 left-0 flex -rotate-2 flex-col items-start gap-1.5">
                <span className="rounded-r-lg bg-surface px-4 py-1.5 text-xl font-extrabold uppercase tracking-tight text-accent-strong shadow-sm">
                  {t(s.a)}
                </span>
                <span className="ml-4 rounded-lg bg-surface px-4 py-1.5 text-xl font-extrabold uppercase tracking-tight text-accent-strong shadow-sm">
                  {t(s.b)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <img src="/favicon.svg" alt="" className="absolute left-4 top-4 size-11 rounded-xl shadow-md" />
      </div>
      <div role="tablist" aria-label={t('authSlides')} className="flex gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.stage}
            role="tab"
            aria-selected={i === index}
            aria-label={t('authSlide', { n: i + 1 })}
            onClick={() => {
              touched.current = true
              go(i)
            }}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-accent-strong' : 'w-2 bg-border hover:bg-accent'}`}
          />
        ))}
      </div>
    </div>
  )
}
