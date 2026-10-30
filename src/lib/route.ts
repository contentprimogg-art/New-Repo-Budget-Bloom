import { useEffect, useState } from 'react'

// Navigation par hash: le bouton « retour » du téléphone fonctionne et les pages sont des liens.
export function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export type Page = 'budget' | 'savings' | 'stats'

export function pageOf(hash: string): Page {
  if (hash.startsWith('#/savings')) return 'savings'
  if (hash.startsWith('#/stats')) return 'stats'
  return 'budget'
}
