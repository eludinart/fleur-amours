type Props = {
  className?: string
  title?: string
}

/** Badge discret pour repérer les comptes de démonstration (seed Mycelium). */
export default function DemoAccountBadge({
  className = '',
  title = 'Compte virtuel — jeu de données de démonstration Mycelium',
}: Props) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 rounded-full border border-dashed border-sky-400/60 bg-sky-50 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-200 ${className}`}
    >
      <span aria-hidden>◇</span>
      Virtuel
    </span>
  )
}
