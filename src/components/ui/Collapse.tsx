import { useEffect, useState } from 'react'

const DURATION = 250

// Bandeau dépliable: glisse à l'ouverture et à la fermeture (0,25 s), quelle que soit sa hauteur.
// Fermé, son contenu n'est plus affiché ni atteignable au clavier.
export default function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(open)
  const [settled, setSettled] = useState(open)

  useEffect(() => {
    let frame = 0
    let timer: ReturnType<typeof setTimeout>
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true)
      // Deux images: le contenu est d'abord posé fermé, pour que le navigateur anime l'ouverture.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setShown(true))
      })
      timer = setTimeout(() => setSettled(true), DURATION + 40)
    } else {
      setSettled(false)
      setShown(false)
      timer = setTimeout(() => setMounted(false), DURATION)
    }
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [open])

  if (!mounted) return null
  return (
    <div className="fold" data-open={shown} data-settled={settled} inert={!open}>
      <div>{children}</div>
    </div>
  )
}
