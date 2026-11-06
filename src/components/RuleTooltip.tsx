import { Info } from 'lucide-react'
import { useId, useState } from 'react'
import { safeHttpsUrl } from '../utils/safeUrl'

export function RuleTooltip({
  ruleId,
  rationale,
  reference,
}: {
  ruleId: string
  rationale: string
  reference: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const href = safeHttpsUrl(reference)
  return (
    <span className="tooltip-wrap">
      <button
        type="button"
        className="icon-button"
        aria-describedby={id}
        aria-expanded={open}
        aria-label={`Rationale for ${ruleId}`}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            setOpen(false)
          }
        }}
      >
        <Info aria-hidden="true" size={16} />
      </button>
      <span id={id} role="tooltip" className={open ? 'tooltip' : 'sr-only'}>
        {rationale}{' '}
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            GitHub documentation
          </a>
        ) : null}
      </span>
    </span>
  )
}
