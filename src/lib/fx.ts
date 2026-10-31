// Taux de change: service gratuit et sans compte, alimenté par la Banque centrale européenne
// (taux du jour ouvré, une fois par jour). Seules les deux devises demandées sont envoyées.
// Les francs CFA ont une parité fixe avec l'euro. Les autres devises non couvertes (MAD, TND,
// DZD…) demandent un taux saisi à la main. Les taux obtenus sont gardés pour le mode hors-ligne.

const API = 'https://api.frankfurter.dev/v1/latest'
const PEG_EUR: Record<string, number> = { XOF: 655.957, XAF: 655.957 } // 1 EUR = 655,957 F CFA
const CACHE_KEY = 'bloomFx'

type Cache = Record<string, { rate: number; date: string }>

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeCache(key: string, rate: number, date: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [key]: { rate, date } }))
  } catch {
    /* stockage indisponible */
  }
}

/** Taux pour convertir 1 unité de « from » en « to », avec sa date; null si indisponible. */
export async function getRate(from: string, to: string): Promise<{ rate: number; date: string } | null> {
  if (from === to) return { rate: 1, date: '' }
  // Parité fixe: on passe par l'euro.
  let base = from
  let target = to
  let factor = 1
  if (PEG_EUR[base]) {
    factor /= PEG_EUR[base]
    base = 'EUR'
  }
  if (PEG_EUR[target]) {
    factor *= PEG_EUR[target]
    target = 'EUR'
  }
  if (base === target) return { rate: factor, date: '' }

  const key = `${base}>${target}`
  try {
    const res = await fetch(`${API}?base=${base}&symbols=${target}`)
    if (res.ok) {
      const json = (await res.json()) as { date: string; rates: Record<string, number> }
      const rate = json.rates?.[target]
      if (rate) {
        writeCache(key, rate, json.date)
        return { rate: rate * factor, date: json.date }
      }
    }
  } catch {
    /* hors-ligne ou service indisponible: dernier taux connu ci-dessous */
  }
  const cached = readCache()[key]
  return cached ? { rate: cached.rate * factor, date: cached.date } : null
}

/** Taux affiché dans un champ modifiable (6 chiffres significatifs, virgule en français). */
export const fmtRate = (rate: number, lng: string) => {
  const text = String(Number(rate.toPrecision(6)))
  return lng.startsWith('fr') ? text.replace('.', ',') : text
}

export const roundMoney = (n: number) => Math.round(n * 100) / 100
