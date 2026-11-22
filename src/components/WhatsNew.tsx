import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LATEST_RELEASE, RELEASES, type Release } from '../data/releases'
import Card from './ui/Card'
import Collapse from './ui/Collapse'
import { PRIMARY } from './ui/Field'
import Sheet from './ui/Sheet'

const SEEN_KEY = 'bloomWhatsNew'

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, LATEST_RELEASE.version)
  } catch {
    /* stockage indisponible */
  }
}

const fmtReleaseDate = (iso: string, lng: string) =>
  new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`))

// Une note de version: version et date en gris, titre en gras, puis listes à puces.
function ReleaseNotes({ release, inHistory = false }: { release: Release; inHistory?: boolean }) {
  const { t, i18n } = useTranslation()
  const text = i18n.language.startsWith('en') ? release.en : release.fr
  return (
    <article className="flex flex-col gap-4">
      {inHistory ? (
        // Dans l'historique, la version et le titre sont déjà sur la ligne dépliable.
        <p className="text-sm leading-relaxed text-muted">{text.intro}</p>
      ) : (
        <header>
          <p className="text-xs text-muted">
            {t('versionLabel', { version: release.version })} · {fmtReleaseDate(release.date, i18n.language)}
          </p>
          <h3 className="mt-1 text-xl font-semibold leading-snug">{text.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{text.intro}</p>
        </header>
      )}
      {text.sections.map((section) => (
        <section key={section.title}>
          <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">{section.title}</h4>
          <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed marker:text-accent-strong">
            {section.items.map((item) => (
              <li key={item.strong}>
                <span className="font-semibold">{item.strong}</span>
                <span className="text-muted"> : {item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  )
}

// Une ancienne version: titre et date, notes dépliables.
function PastRelease({ release }: { release: Release }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const text = i18n.language.startsWith('en') ? release.en : release.fr
  return (
    <li className="py-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{text.title}</span>
          <span className="block text-xs text-muted">
            {t('versionLabel', { version: release.version })} · {fmtReleaseDate(release.date, i18n.language)}
          </span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <Collapse open={open}>
        <div className="pt-3">
          <ReleaseNotes release={release} inHistory />
        </div>
      </Collapse>
    </li>
  )
}

function WhatsNewSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [history, setHistory] = useState(false)
  const older = RELEASES.slice(1)
  return (
    <Sheet title={t('whatsNew')} onClose={onClose}>
      <ReleaseNotes release={LATEST_RELEASE} />
      {older.length > 0 && (
        <div className="border-t border-dashed border-muted/30 pt-3">
          <button type="button" onClick={() => setHistory(!history)} aria-expanded={history} className="flex items-center gap-1.5 text-sm font-medium text-accent-strong">
            {t('previousVersions')}
            <ChevronDown size={15} className={`transition-transform duration-200 ${history ? 'rotate-180' : ''}`} />
          </button>
          <Collapse open={history}>
            <ul className="mt-2 flex flex-col divide-y divide-dashed divide-muted/30">
              {older.map((r) => (
                <PastRelease key={r.version} release={r} />
              ))}
            </ul>
          </Collapse>
        </div>
      )}
      <button type="button" onClick={onClose} className={PRIMARY}>
        {t('continue')}
      </button>
    </Sheet>
  )
}

/** S'ouvre une fois par nouvelle version. Un compte créé après cette version ne la voit pas. */
export default function WhatsNew({ accountCreatedAt }: { accountCreatedAt?: string }) {
  const [open, setOpen] = useState(() => {
    if (readSeen() === LATEST_RELEASE.version) return false
    const isNewAccount = !!accountCreatedAt && accountCreatedAt.slice(0, 10) >= LATEST_RELEASE.date && !readSeen()
    if (isNewAccount) {
      markSeen()
      return false
    }
    return true
  })
  if (!open) return null
  return (
    <WhatsNewSheet
      onClose={() => {
        markSeen()
        setOpen(false)
      }}
    />
  )
}

// Carte du profil: version actuelle et accès à l'historique.
export function WhatsNewCard() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Card
        title={t('whatsNew')}
        description={`${t('versionLabel', { version: LATEST_RELEASE.version })} · ${fmtReleaseDate(LATEST_RELEASE.date, i18n.language)}`}
        action={
          <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-accent-soft px-4 py-2 text-sm font-medium text-accent-strong">
            {t('seeUpdates')}
          </button>
        }
      />
      {open && <WhatsNewSheet onClose={() => setOpen(false)} />}
    </>
  )
}

/** Aperçu de développement. */
export const WhatsNewPreview = () => <WhatsNewSheet onClose={() => {}} />
