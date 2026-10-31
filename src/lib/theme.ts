// Palettes au choix: seule la couleur d'accent est stockée; les nuances (claire, très claire)
// sont dérivées en CSS avec color-mix. La seconde couleur des graphiques est choisie pour rester
// distincte de l'accent (paires validées pour les préréglages).

export interface Palette {
  id: string
  accent: string
  chart2: string
}

export const PRESETS: Palette[] = [
  { id: 'rose', accent: '#E46A9E', chart2: '#6C8ED6' },
  { id: 'sage', accent: '#3B9A6C', chart2: '#8A6FD6' },
  { id: 'lavender', accent: '#8B6FD1', chart2: '#D98A3D' },
  { id: 'coral', accent: '#D9714A', chart2: '#5C8FD6' },
  { id: 'office', accent: '#4472C4', chart2: '#ED7D31' },
]
export const DEFAULT_PALETTE = PRESETS[0]

const KEY = 'bloomPalette'
export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function luminance(hex: string) {
  const [r, g, b] = channels(hex).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function oklab(hex: string) {
  const [r, g, b] = channels(hex).map(linear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
const distance = (a: string, b: string) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]))

/** Palette pour une couleur libre: la seconde couleur de graphique la plus éloignée de l'accent. */
export function customPalette(accent: string): Palette {
  const candidates = ['#6C8ED6', '#D98A3D', '#8A6FD6', '#3B9A6C', '#E46A9E']
  const chart2 = candidates.reduce((best, c) => (distance(c, accent) > distance(best, accent) ? c : best))
  return { id: 'custom', accent, chart2 }
}

export function paletteFrom(value: unknown): Palette | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<Palette>
  const preset = PRESETS.find((p) => p.id === v.id)
  if (preset) return preset
  return v.id === 'custom' && isHex(v.accent) ? customPalette(v.accent) : null
}

export function applyPalette(p: Palette) {
  const root = document.documentElement.style
  root.setProperty('--accent-strong', p.accent)
  root.setProperty('--chart-2', p.chart2)
  // Texte sur les boutons d'accent: blanc tant qu'il reste lisible, sinon encre foncée.
  root.setProperty('--on-accent', contrast('#ffffff', p.accent) >= 3 ? '#ffffff' : '#1a1d20')
}

export function storedPalette(): Palette | null {
  try {
    return paletteFrom(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return null
  }
}

export function storePalette(p: Palette) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: p.id, accent: p.accent }))
  } catch {
    /* stockage indisponible */
  }
}

// ---- Thème clair / sombre ----
// « auto » suit le réglage du téléphone; « light » / « dark » le forcent (attribut data-theme).
// Ce choix est propre à chaque appareil (stocké localement).

export type ThemeMode = 'auto' | 'light' | 'dark'
const MODE_KEY = 'bloomTheme'

export function storedThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** La barre du navigateur prend la couleur du fond papier du thème actif. */
export function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
  if (meta && paper) meta.content = paper
}

export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
  syncThemeColor()
}

export function storeThemeMode(mode: ThemeMode) {
  try {
    if (mode === 'auto') localStorage.removeItem(MODE_KEY)
    else localStorage.setItem(MODE_KEY, mode)
  } catch {
    /* stockage indisponible */
  }
}
