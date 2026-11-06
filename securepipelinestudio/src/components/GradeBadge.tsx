import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react'
import type { Grade } from '../utils/model'

const ICONS = {
  A: ShieldCheck,
  B: Shield,
  C: ShieldAlert,
  D: ShieldAlert,
  F: ShieldX,
} as const

export function GradeBadge({ grade, size = 'lg' }: { grade: Grade | null; size?: 'lg' | 'sm' }) {
  const Icon = grade ? ICONS[grade] : ShieldQuestion
  const label = grade ? `Grade ${grade}` : 'Not graded'
  return (
    <div
      className={grade ? `grade-badge grade-${grade}` : 'grade-badge'}
      style={size === 'sm' ? { width: 56, height: 56 } : undefined}
      role="img"
      aria-label={label}
    >
      <strong>{grade ?? '?'}</strong>
      <span>
        <Icon aria-hidden="true" size={14} />
        {grade ?? '—'}
      </span>
    </div>
  )
}
