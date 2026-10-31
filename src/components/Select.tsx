import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

export type Align = 'left' | 'center' | 'right'

const TEXT_ALIGN: Record<Align, string> = { left: 'text-left', center: 'text-center', right: 'text-right' }
const OPTION_HEIGHT = 40
/** Au-delà, la liste défile (6 options et demie visibles: la demi-option montre qu'il y a une suite). */
const MAX_VISIBLE = 6.5

// Liste déroulante aux couleurs du thème: le champ et la liste forment une seule forme,
// seuls les coins extérieurs sont arrondis. La liste est dans un portail (position fixe)
// pour ne pas être coupée par le défilement horizontal du tableau.
export default function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  align = 'left',
  variant = 'cell',
  className = '',
  ...dataProps
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  label: string
  align?: Align
  /** « cell »: sans bordure au repos (tableau). « field »: champ de formulaire avec bordure. */
  variant?: 'cell' | 'field'
  className?: string
  'data-row'?: number
  'data-col'?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [up, setUp] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  function openList() {
    const r = button.current!.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    setUp(below < Math.min(options.length, MAX_VISIBLE) * OPTION_HEIGHT + 12 && r.top > below)
    setRect(r)
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  function choose(i: number) {
    onChange(options[i].value)
    setOpen(false)
    button.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    // Défiler dans la liste elle-même ne la ferme pas; défiler la page, si (elle ne suivrait plus le champ).
    const onScroll = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) close()
    }
    // Option choisie visible dès l'ouverture d'une longue liste.
    const ul = list.current
    const selected = ul?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (ul && selected) ul.scrollTop = selected.offsetTop - ul.clientHeight / 2 + OPTION_HEIGHT / 2
    const onDown = (e: Event) => {
      const n = e.target as Node
      if (!button.current?.contains(n) && !list.current?.contains(n)) close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + options.length) % options.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  // Ouvert vers le bas: seuls les coins du haut du champ sont arrondis (et ceux du bas de la liste).
  // Le bord côté liste est supprimé (et compensé en padding) plutôt que rendu transparent:
  // un bord transparent contre des bords colorés dessine un biseau à la jonction.
  const shape = open
    ? up
      ? 'rounded-b-lg rounded-t-none border-t-0 pt-[9px] pb-[7px]'
      : 'rounded-t-lg rounded-b-none border-b-0 pt-[7px] pb-[9px]'
    : 'rounded-lg py-[7px]'

  return (
    <>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
        className={`flex w-full items-center gap-2 border-2 px-[9px] ${shape} ${
          open
            ? 'border-accent-strong bg-surface'
            : variant === 'field'
              ? 'border-border bg-surface hover:border-accent'
              : 'border-transparent hover:border-accent'
        } ${className}`}
        {...dataProps}
      >
        <span className={`flex-1 truncate ${TEXT_ALIGN[align]}`}>{current.label}</span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`size-3 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        rect &&
        createPortal(
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            style={{
              position: 'fixed',
              left: rect.left,
              width: rect.width,
              ...(up ? { bottom: window.innerHeight - rect.top } : { top: rect.bottom }),
              maxHeight: Math.min(MAX_VISIBLE * OPTION_HEIGHT + 8, (up ? rect.top : window.innerHeight - rect.bottom) - 8),
            }}
            className={`fade-up z-50 overflow-y-auto overscroll-contain border-2 border-accent-strong bg-surface py-1 ${
              up ? 'rounded-t-lg border-b-0' : 'rounded-b-lg border-t-0'
            }`}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                style={{ height: OPTION_HEIGHT }}
                className={`flex cursor-pointer items-center gap-2 px-2.5 text-sm ${TEXT_ALIGN[align]} ${
                  i === active ? 'bg-accent-soft' : ''
                } ${o.value === value ? 'font-medium text-accent-strong' : ''}`}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {o.value === value && (
                  <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0">
                    <path
                      d="m3.5 8.5 3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}
