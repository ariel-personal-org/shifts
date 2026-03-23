import { addHours, parseISO, format, isAfter, isBefore, isEqual } from 'date-fns';

export interface GeneratedShift {
  start_datetime: Date;
  end_datetime: Date;
  index: number;
}

export function generateShifts(
  startDate: string, // "YYYY-MM-DD"
  endDate: string,   // "YYYY-MM-DD"
  cycleStartTime: string, // "HH:MM"
  durationHours: number
): GeneratedShift[] {
  const [startHour, startMin] = cycleStartTime.split(':').map(Number);

  // Build first shift start: startDate at cycleStartTime
  const rangeStart = parseISO(`${startDate}T00:00:00`);
  const rangeEnd = parseISO(`${endDate}T23:59:59`);

  let shiftStart = new Date(rangeStart);
  shiftStart.setHours(startHour, startMin, 0, 0);

  const result: GeneratedShift[] = [];
  let index = 0;

  while (!isAfter(shiftStart, rangeEnd)) {
    const shiftEnd = addHours(shiftStart, durationHours);
    // Include shift if its start is within the range
    if (!isAfter(shiftStart, rangeEnd)) {
      result.push({
        start_datetime: new Date(shiftStart),
        end_datetime: new Date(shiftEnd),
        index,
      });
    }
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
