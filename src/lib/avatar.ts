// Préparation de la photo de profil: presque tous les formats sont acceptés (JPEG, PNG, WebP,
// AVIF, GIF, SVG, BMP, HEIC/HEIF des iPhone). La photo est recadrée en carré, réduite et
// ré-encodée en JPEG (taille réduite, métadonnées GPS supprimées). Un GIF léger est gardé tel
// quel pour conserver son animation.

const EXT = /\.(jpe?g|png|gif|webp|avif|svg|bmp|heic|heif)$/i
const HEIC = /\.(heic|heif)$/i
export const MAX_GIF = 5 * 1024 * 1024

export const isImageFile = (file: File) => file.type.startsWith('image/') || EXT.test(file.name)
export const ACCEPT = 'image/*,.heic,.heif,.avif,.svg,.gif'

type Drawable = ImageBitmap | HTMLImageElement

async function decode(blob: Blob): Promise<Drawable> {
  try {
    return await createImageBitmap(blob)
  } catch {
    // Repli par un élément <img>: SVG et formats que createImageBitmap refuse.
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
}

async function heicToJpeg(file: File): Promise<Blob> {
  try {
    await createImageBitmap(file) // Safari sait lire le HEIC directement
    return file
  } catch {
    // Autres navigateurs: conversion chargée seulement quand c'est nécessaire.
    const { default: heic2any } = await import('heic2any')
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    return Array.isArray(out) ? out[0] : out
  }
}

export async function prepareAvatar(file: File, size = 768): Promise<{ blob: Blob; ext: 'jpg' | 'gif'; type: string }> {
  const gif = file.type === 'image/gif' || /\.gif$/i.test(file.name)
  if (gif && file.size <= MAX_GIF) return { blob: file, ext: 'gif', type: 'image/gif' }

  const source = HEIC.test(file.name) || /hei[cf]/i.test(file.type) ? await heicToJpeg(file) : file
  const image = await decode(source)
  const w = ('naturalWidth' in image ? image.naturalWidth : image.width) || size
  const h = ('naturalHeight' in image ? image.naturalHeight : image.height) || size
  const side = Math.min(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponible')
  ctx.fillStyle = '#ffffff' // fond blanc pour les images transparentes (PNG, SVG)
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(image, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size)
  if ('close' in image) image.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encodage impossible'))), 'image/jpeg', 0.86),
  )
  return { blob, ext: 'jpg', type: 'image/jpeg' }
}
