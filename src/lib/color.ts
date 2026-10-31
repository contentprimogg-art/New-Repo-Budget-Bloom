// Conversions de couleurs et teintes suggérées pour un emoji.

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)]
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/** Fonds doux qui vont avec la plupart des emojis (style des icônes d'app iOS). */
export const PASTELS = ['#FBE3EC', '#FDE6D6', '#FFF1C7', '#E2F3E6', '#DCEFF5', '#E3E8FB', '#EEE4FA', '#F3E9DC', '#ECEAE6']

const tintCache = new Map<string, string[]>()

/** Trois teintes (très douce, douce, soutenue) tirées des couleurs de l'emoji tel que l'appareil l'affiche. */
export function emojiTints(emoji: string): string[] {
  const cached = tintCache.get(emoji)
  if (cached) return cached
  const size = 40
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return PASTELS.slice(0, 3)
  ctx.font = `${size - 6}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + 2)
  const { data } = ctx.getImageData(0, 0, size, size)

  // Teinte moyenne des pixels colorés (on ignore le transparent, le quasi-blanc et le quasi-noir),
  // pondérée par la saturation pour que la couleur dominante l'emporte.
  let x = 0
  let y = 0
  let weight = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 160) continue
    const hex = `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    const [h, s, l] = hexToHsl(hex)
    if (s < 18 || l < 12 || l > 92) continue
    const w = s / 100
    x += Math.cos((h * Math.PI) / 180) * w
    y += Math.sin((h * Math.PI) / 180) * w
    weight += w
  }
  const tints =
    weight < 1
      ? ['#F1EFEA', '#E3E0D9', '#B9B3A8'] // emoji sans couleur dominante (noir, blanc, gris)
      : (() => {
          const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
          return [hslToHex(hue, 75, 93), hslToHex(hue, 65, 85), hslToHex(hue, 55, 70)]
        })()
  tintCache.set(emoji, tints)
  return tints
}

/** Couleur utilisable dans un graphique: un fond pastel (emoji) est ravivé, le reste est gardé tel quel. */
export function chartColor(color: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color
  const [h, s, l] = hexToHsl(color)
  return l > 75 ? hslToHex(h, Math.max(s, 50), 60) : color
}
