import { addHours, isAfter } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export interface GeneratedShift {
  start_datetime: Date;
  end_datetime: Date;
  index: number;
}

export function generateShifts(
  startDate: string, // "YYYY-MM-DD"
  endDate: string,   // "YYYY-MM-DD"
  cycleStartTime: string, // "HH:MM"
  durationHours: number,
  timezone: string // IANA timezone, e.g. "Asia/Jerusalem"
): GeneratedShift[] {
  // Convert the cycle start time in the given timezone to UTC
  let shiftStart = fromZonedTime(`${startDate}T${cycleStartTime}:00`, timezone);
  const rangeEnd = fromZonedTime(`${endDate}T23:59:59`, timezone);

  const result: GeneratedShift[] = [];
  let index = 0;

  while (!isAfter(shiftStart, rangeEnd)) {
    const shiftEnd = addHours(shiftStart, durationHours);
    result.push({
      start_datetime: new Date(shiftStart),
      end_datetime: new Date(shiftEnd),
      index,
    });
    shiftStart = shiftEnd;
    index++;
  }

  return result;
}

export function shiftsOverlap(
  a: { start_datetime: Date | string; end_datetime: Date | string },
  b: { start_datetime: Date | string; end_datetime: Date | string }
): boolean {
  const aStart = new Date(a.start_datetime);
  const aEnd = new Date(a.end_datetime);
  const bStart = new Date(b.start_datetime);
  const bEnd = new Date(b.end_datetime);
  return aStart < bEnd && aEnd > bStart;
}
