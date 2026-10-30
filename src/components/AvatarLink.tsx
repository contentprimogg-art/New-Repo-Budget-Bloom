import { useTranslation } from 'react-i18next'
import Avatar from './Avatar'

// Pastille en haut à droite: ouvre le profil.
export default function AvatarLink() {
  const { t } = useTranslation()
  return (
    <a
      href="#/profile"
      aria-label={t('profileTitle')}
      title={t('profileTitle')}
      className="no-print rounded-full ring-2 ring-surface transition hover:ring-accent"
    >
      <Avatar />
    </a>
  )
}
