// Écran de démarrage: le logo « respire » au centre, sur le fond papier.
// Identique à la version statique d'index.html, pour un enchaînement sans saut.
export default function Splash() {
  return (
    <div role="status" aria-label="Budget Bloom" className="grid min-h-dvh place-items-center">
      <img src="/favicon.svg" alt="" className="breathe size-20 rounded-[22px] shadow-lg shadow-accent/25" />
    </div>
  )
}
