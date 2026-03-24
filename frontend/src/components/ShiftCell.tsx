import type { ShiftState } from '../types';
import { UserCheck, Home, Clock, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ShiftCellProps {
  state: ShiftState;
  hasPendingRequest: boolean;
  isAdmin?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const STATE_STYLES: Record<ShiftState, string> = {
  in_shift: 'bg-green-100 text-green-800 border-green-200',
  available: 'bg-gray-50 text-gray-500 border-gray-200',
  home: 'bg-red-100 text-red-800 border-red-200',
};

const STATE_ICONS: Partial<Record<ShiftState, LucideIcon>> = {
  in_shift: UserCheck,
  home: Home,
};

export default function ShiftCell({
  state,
  hasPendingRequest,
  isAdmin = false,
  onClick,
  disabled = false,
}: ShiftCellProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`relative min-w-[90px] h-16 border rounded-lg p-1.5 flex flex-col items-center justify-center gap-0.5 transition-all
        ${STATE_STYLES[state]}
        ${isAdmin && !disabled ? 'cursor-pointer hover:opacity-80 hover:shadow-sm' : 'cursor-default'}
        ${disabled ? 'opacity-50' : ''}
      `}
      onClick={isAdmin && !disabled ? onClick : undefined}
    >
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold leading-none">
        {STATE_ICONS[state] && (() => { const Icon = STATE_ICONS[state]!; return <Icon className="w-3 h-3" />; })()}
        {t(`shifts.${state}`)}
      </span>
      {hasPendingRequest && (
        <span className="flex items-center gap-0.5 text-[9px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200 mt-0.5">
          <Clock className="w-2 h-2" />
          {t('shifts.pending')}
        </span>
      )}
      {isAdmin && (
        <ChevronDown className="w-2.5 h-2.5 absolute bottom-1 right-1 opacity-30" />
      )}
    </div>
  );
}
