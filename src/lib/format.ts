export const fmtMoney = (n: number, lng: string) =>
  new Intl.NumberFormat(lng, { style: 'currency', currency: 'EUR' }).format(n)

export const fmtDate = (iso: string, lng: string) =>
  new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`))

export const fmtMonth = (month: string, lng: string, style: 'long' | 'short' = 'long') =>
  new Intl.DateTimeFormat(lng, style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' }).format(
    new Date(`${month}-01T12:00:00`),
  )

export const parseAmount = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

// Date proposée par défaut pour une dépense: aujourd'hui si on est dans ce mois, sinon le 1er du mois affiché.
export const defaultDateFor = (month: string) => {
  const today = todayIso()
  return today.startsWith(month) ? today : `${month}-01`
}

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
