import type { Member } from '../../lib/household'

// Photo d'un membre, ou son initiale sur fond doux.
export function MemberAvatar({ member, size = 22, style }: { member: Member; size?: number; style?: React.CSSProperties }) {
  const box = { width: size, height: size, ...style }
  return member.avatarUrl ? (
    <img src={member.avatarUrl} alt={member.name} title={member.name} className="shrink-0 rounded-full object-cover" style={box} />
  ) : (
    <span
      title={member.name}
      aria-label={member.name}
      className="grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent-strong"
      style={{ ...box, fontSize: size * 0.45 }}
    >
      {member.name[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

// Photos qui se chevauchent: chaque photo (sauf la dernière) est découpée en croissant de lune
// sur son bord droit, et la suivante vient se loger dans ce creux, avec un petit écart.
export default function AvatarStack({ members, size = 22, max = 3 }: { members: Member[]; size?: number; max?: number }) {
  if (members.length === 0) return null
  const shown = members.slice(0, max)
  const extra = members.length - shown.length
  const overlap = size * 0.36
  const gap = 1.8
  const nextCenter = size - overlap + size / 2 // centre de la photo suivante, vu depuis la photo courante

  return (
    <span className="inline-flex items-center" aria-label={members.map((m) => m.name).join(', ')}>
      {shown.map((m, i) => {
        const last = i === shown.length - 1 && extra === 0
        const mask = last
          ? undefined
          : `radial-gradient(circle at ${nextCenter}px 50%, transparent ${size / 2 + gap}px, #000 ${size / 2 + gap + 0.6}px)`
        return (
          <MemberAvatar
            key={m.id}
            member={m}
            size={size}
            style={{ marginLeft: i ? -overlap : 0, WebkitMaskImage: mask, maskImage: mask }}
          />
        )
      })}
      {extra > 0 && (
        <span
          className="grid shrink-0 place-items-center rounded-full bg-track font-semibold text-muted"
          style={{ width: size, height: size, marginLeft: -overlap, fontSize: size * 0.4 }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}
