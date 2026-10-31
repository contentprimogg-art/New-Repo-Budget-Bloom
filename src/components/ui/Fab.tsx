import { Plus } from 'lucide-react'

// Bouton rond « + » pour ajouter une dépense.
export default function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fab no-print absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-5 z-40 grid size-15 place-items-center text-on-accent md:bottom-8 md:right-8"
    >
      <Plus size={28} strokeWidth={2.2} />
    </button>
  )
}
