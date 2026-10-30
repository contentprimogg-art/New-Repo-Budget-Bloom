// Recadre la photo en carré, la réduit et la ré-encode en JPEG: taille réduite et métadonnées
// de l'appareil photo (position GPS, etc.) supprimées avant l'envoi.
export async function resizeToJpeg(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponible')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encodage impossible'))), 'image/jpeg', 0.85),
  )
}
