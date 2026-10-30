export const fmtMoney = (n: number, lng: string) =>
  new Intl.NumberFormat(lng, { style: 'currency', currency: 'EUR' }).format(n)

export const fmtDate = (iso: string, lng: string) =>
  new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`))

export const parseAmount = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
