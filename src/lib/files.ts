export function downloadFile(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Ouvre la feuille de partage du téléphone (Mail, Messages…) avec le fichier en pièce jointe.
 *  Renvoie false si le navigateur ne sait pas partager de fichier (ordinateur, souvent). */
export async function shareFile(file: File, title: string, text: string): Promise<boolean> {
  if (!navigator.canShare?.({ files: [file] })) return false
  try {
    await navigator.share({ files: [file], title, text })
    return true
  } catch (e) {
    return (e as DOMException).name === 'AbortError' // annulé par l'utilisateur: pas une erreur
  }
}

export function openMailDraft(subject: string, body: string) {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
