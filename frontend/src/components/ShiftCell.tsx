import type { ShiftState } from '../types';

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

const STATE_LABELS: Record<ShiftState, string> = {
  in_shift: 'In Shift',
  available: 'Available',
  home: 'Home',
};

export default function ShiftCell({
  state,
  hasPendingRequest,
  isAdmin = false,
  onClick,
  disabled = false,
}: ShiftCellProps) {
  return (
    <div
      className={`relative min-w-[90px] h-16 border rounded-lg p-1.5 flex flex-col items-center justify-center gap-0.5 transition-all
        ${STATE_STYLES[state]}
        ${isAdmin && !disabled ? 'cursor-pointer hover:opacity-80 hover:shadow-sm' : 'cursor-default'}
        ${disabled ? 'opacity-50' : ''}
      `}
      onClick={isAdmin && !disabled ? onClick : undefined}
    >
      <span className="text-xs font-semibold leading-none">{STATE_LABELS[state]}</span>
      {hasPendingRequest && (
        <span className="flex items-center gap-0.5 text-[9px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200 mt-0.5">
          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          Pending
        </span>
      )}
      {isAdmin && (
        <svg className="w-2.5 h-2.5 absolute bottom-1 right-1 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </div>
  );
}
