// Titre de section en écriture manuscrite (police définie par --font-script).
export default function ScriptTitle({
  as: Tag = 'h2',
  className = '',
  children,
}: {
  as?: 'h1' | 'h2' | 'h3'
  className?: string
  children: React.ReactNode
}) {
  return <Tag className={`font-script text-4xl font-normal leading-tight ${className}`}>{children}</Tag>
}
