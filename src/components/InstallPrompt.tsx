import { Download, Share, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isNative } from '../lib/push'

// APK Android publié avec le site (npm run apk le copie dans public/).
const APK_URL = '/budget-bloom.apk'

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string }
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

function isAppInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const isAndroid = () => /Android/i.test(navigator.userAgent)

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function InstallPrompt({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  // Dans l'APK, l'appli est déjà installée.
  const [installed, setInstalled] = useState(() => isAppInstalled() || isNative())
  const [dismissed, setDismissed] = useState(false)
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isPrompting, setIsPrompting] = useState(false)
  const [promptError, setPromptError] = useState(false)
  const appleMobile = isAppleMobile()
  const android = isAndroid()
  const visible = !installed && !dismissed

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }

    function onAppInstalled() {
      setInstalled(true)
      setInstallEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (!showInstructions) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowInstructions(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showInstructions])

  async function install() {
    // Android: on télécharge l'APK, puis on explique comment l'ouvrir.
    if (android) {
      const link = document.createElement('a')
      link.href = APK_URL
      link.download = 'budget-bloom.apk'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setShowInstructions(true)
      return
    }
    if (!installEvent) {
      setShowInstructions(true)
      return
    }

    setIsPrompting(true)
    setPromptError(false)
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      setInstallEvent(null)
      if (choice.outcome === 'accepted') setInstalled(true)
    } catch (error) {
      console.error('Impossible de lancer l’installation de Budget Bloom.', error)
      setPromptError(true)
      setShowInstructions(true)
    } finally {
      setIsPrompting(false)
    }
  }

  return (
    <div className="install-frame">
      {visible && (
        <aside className="install-banner" aria-label={t('installBannerTitle')}>
          <p className="min-w-0 flex-1 text-sm font-semibold">{t('installBannerTitle')}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void install()}
              disabled={isPrompting}
              className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-on-accent"
            >
              {t('installDownload')}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-full border border-accent-strong px-3 py-2 text-sm font-medium text-accent-strong"
            >
              {t('installIgnore')}
            </button>
          </div>
        </aside>
      )}
      <div className="install-frame-content">{children}</div>

      {showInstructions && (
        <div className="install-dialog-backdrop">
          <section
            className="install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-dialog-title"
          >
            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="install-dialog-close"
              aria-label={t('close')}
            >
              <X size={20} />
            </button>
            <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
              {android ? <Download size={23} /> : <Share size={23} />}
            </div>
            <h2 id="install-dialog-title" className="mb-2 text-lg font-semibold">
              {t('installInstructionsTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              {android ? t('installInstructionsApk') : appleMobile ? t('installInstructionsIos') : t('installInstructionsOther')}
            </p>
            {android && (
              <a href={APK_URL} download="budget-bloom.apk" className="mt-4 inline-block text-sm font-medium text-accent-strong underline underline-offset-4">
                {t('installApkAgain')}
              </a>
            )}
            {promptError && (
              <p role="alert" className="mt-3 text-sm text-over">
                {t('installPromptError')}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
