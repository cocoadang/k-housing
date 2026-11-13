import React from 'react';
import { CheckCircle2, FileText, FlaskConical, AlertCircle, HelpCircle } from 'lucide-react';

export type EvidenceBadgeLevel =
  | 'VERIFIED'
  | 'SUPPORTED'
  | 'RESEARCH_ONLY'
  | 'PENDING'
  | 'OFFICIAL_GAZETTE'
  | 'ASSOCIATION_DOCUMENT'
  | 'REFERENCE'
  | 'DATA_NOT_AVAILABLE'
  | string;

interface EvidenceBadgeProps {
  level: EvidenceBadgeLevel;
  className?: string;
  size?: 'sm' | 'md';
}

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({
  level,
  className = '',
  size = 'md',
}) => {
  const norm = (level || '').toUpperCase();

  let label = '확인 필요';
  let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
  let Icon = HelpCircle;

  if (norm === 'OFFICIAL_GAZETTE' || norm.includes('GAZETTE')) {
    label = '지자체 고시';
    badgeStyle = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    Icon = FileText;
  } else if (norm === 'ASSOCIATION_DOCUMENT' || norm.includes('ASSOCIATION')) {
    label = '조합 원본서류';
    badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    Icon = CheckCircle2;
  } else if (norm === 'DATA_NOT_AVAILABLE' || norm.includes('NOT_AVAILABLE')) {
    label = '자료 미확보';
    badgeStyle = 'bg-slate-800/80 text-slate-400 border-slate-700/60';
    Icon = AlertCircle;
  } else if (norm === 'REFERENCE' || norm.includes('RESEARCH') || norm.includes('EXAMPLE')) {
    label = '참고자료 (RESEARCH)';
    badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    Icon = FlaskConical;
  } else if (norm.includes('VERIFIED')) {
    label = '검증됨';
    badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    Icon = CheckCircle2;
  } else if (norm.includes('SUPPORTED')) {
    label = '보조자료';
    badgeStyle = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    Icon = FileText;
  } else if (norm.includes('PENDING') || norm.includes('UNVERIFIED') || norm.includes('UNKNOWN')) {
    label = '확인 필요';
    badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
    Icon = AlertCircle;
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px] gap-1'
      : 'px-2 py-0.5 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${badgeStyle} ${sizeClasses} ${className}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label}</span>
    </span>
  );
};
