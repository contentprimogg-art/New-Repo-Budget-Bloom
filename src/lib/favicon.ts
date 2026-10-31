// Icône de l'onglet du navigateur: la photo de profil du compte, découpée en rond.
// Gardée sur l'appareil pour s'afficher dès l'ouverture; sans photo, on revient au logo.

const KEY = 'bloomFavicon'

function links() {
  return [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')]
}

export function applyFavicon(url: string | null) {
  for (const link of links()) {
    // L'icône d'origine est mémorisée sur la balise pour pouvoir y revenir.
    if (!link.dataset.default) {
      link.dataset.default = link.href
      link.dataset.defaultType = link.type
    }
    link.href = url ?? link.dataset.default
    link.type = url ? 'image/png' : (link.dataset.defaultType ?? '')
  }
}

export function storedFavicon() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function storeFavicon(url: string | null) {
  try {
    if (url) localStorage.setItem(KEY, url)
    else localStorage.removeItem(KEY)
  } catch {
    /* stockage indisponible */
  }
  applyFavicon(url)
}

/** Photo ronde de 64 px (PNG) à partir de l'image; pour un GIF animé, la première image. */
export async function roundIcon(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()
    // Recadrage centré (comme object-fit: cover).
    const side = Math.min(bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
    bitmap.close()
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
