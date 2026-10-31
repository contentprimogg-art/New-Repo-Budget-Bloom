import {
  Baby,
  BookOpen,
  Bus,
  Car,
  CarTaxiFront,
  Clapperboard,
  Coffee,
  Dumbbell,
  Euro,
  Flower2,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  Headphones,
  Heart,
  House,
  Landmark,
  Lightbulb,
  PawPrint,
  Percent,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Sprout,
  Train,
  Umbrella,
  Utensils,
  Wifi,
  Wine,
  type LucideIcon,
} from 'lucide-react'

// Icônes au trait (style du moodboard), stockées en base par leur clé.
export const ICONS: Record<string, LucideIcon> = {
  cart: ShoppingCart,
  bag: ShoppingBag,
  food: Utensils,
  coffee: Coffee,
  wine: Wine,
  home: House,
  bulb: Lightbulb,
  wifi: Wifi,
  phone: Smartphone,
  bill: Receipt,
  car: Car,
  fuel: Fuel,
  bus: Bus,
  train: Train,
  taxi: CarTaxiFront,
  plane: Plane,
  film: Clapperboard,
  game: Gamepad2,
  music: Headphones,
  book: BookOpen,
  school: GraduationCap,
  shirt: Shirt,
  beauty: Sparkles,
  health: Pill,
  gym: Dumbbell,
  pet: PawPrint,
  baby: Baby,
  gift: Gift,
  flower: Flower2,
  heart: Heart,
  tools: Hammer,
  umbrella: Umbrella,
  piggy: PiggyBank,
  bank: Landmark,
  sprout: Sprout,
  percent: Percent,
  euro: Euro,
}
export const ICON_KEYS = Object.keys(ICONS)

// Couleurs des pastilles, dans un ordre fixe validé (attribuées dans cet ordre aux nouvelles enveloppes).
// Le rose et le vert voisins restent proches pour un daltonien: l'anneau hachuré, les icônes
// et les pourcentages servent de second repère.
export const BADGE_COLORS = ['#E8749E', '#3FA37A', '#A07FE0', '#E58C3E', '#4F8FDB', '#C9A227', '#D9607A', '#2FA3B0', '#B0743F']
export const colorForIndex = (i: number) => BADGE_COLORS[i % BADGE_COLORS.length]

// Anciennes teintes pastel (première version) → couleurs saturées équivalentes.
const LEGACY: Record<string, string> = {
  '#FBE6EF': '#E8749E',
  '#F9DDE0': '#D9607A',
  '#FFF1D6': '#C9A227',
  '#E8F3EA': '#3FA37A',
  '#E6EEF9': '#4F8FDB',
  '#EFE6F7': '#A07FE0',
  '#F3E9DC': '#B0743F',
}
export const badgeColor = (c: string | null | undefined) => (c ? (LEGACY[c.toUpperCase()] ?? c) : 'var(--accent-strong)')

const SIZES = {
  sm: { box: 'size-8', icon: 16, emoji: 'text-base' },
  md: { box: 'size-10', icon: 19, emoji: 'text-xl' },
  lg: { box: 'size-14', icon: 26, emoji: 'text-3xl' },
}

/** Vrai si l'icône est un emoji (et non une icône au trait). */
export const isEmoji = (icon: string | null | undefined): icon is string => !!icon && !ICONS[icon]

/** Pastille ronde: icône au trait blanche sur fond coloré, ou emoji (police du système) sur fond doux. */
export function IconBadge({
  icon,
  color,
  size = 'md',
  className = '',
}: {
  icon: string | null | undefined
  color: string | null | undefined
  size?: keyof typeof SIZES
  className?: string
}) {
  const s = SIZES[size]
  const Glyph = icon ? ICONS[icon] : Flower2
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full text-white ${s.box} ${className}`}
      style={{ background: badgeColor(color) }}
    >
      {Glyph ? <Glyph size={s.icon} strokeWidth={2} /> : <span className={`emoji ${s.emoji}`}>{icon}</span>}
    </span>
  )
}

/** Icône seule, colorée (grille de catégories du moodboard). */
export function IconGlyph({ icon, color, size = 26 }: { icon: string | null | undefined; color: string | null | undefined; size?: number }) {
  const Glyph = icon ? ICONS[icon] : Flower2
  return Glyph ? (
    <Glyph aria-hidden size={size} strokeWidth={1.8} style={{ color: badgeColor(color) }} />
  ) : (
    <span aria-hidden className="emoji" style={{ fontSize: size * 0.95 }}>
      {icon}
    </span>
  )
}
