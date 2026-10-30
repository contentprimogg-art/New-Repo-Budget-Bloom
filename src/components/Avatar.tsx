import { useProfile } from '../lib/profile'

// Photo de profil, ou initiale sur fond rose pâle si aucune photo.
export default function Avatar({ className = 'size-10 text-base' }: { className?: string }) {
  const { avatarUrl, profile } = useProfile()
  return avatarUrl ? (
    <img src={avatarUrl} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent-strong ${className}`}
    >
      {profile.firstName?.[0]?.toUpperCase() ?? '🌸'}
    </span>
  )
}
