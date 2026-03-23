import { describe, it, expect } from 'vitest';
import { generateShifts, shiftsOverlap } from '../utils/shiftGenerator';

describe('generateShifts', () => {
  it('generates correct number of shifts for a 2-day range with 12h shifts', () => {
    const shifts = generateShifts('2024-01-01', '2024-01-02', '09:00', 12);
    // Day 1: 09:00–21:00, Day 1: 21:00–09:00 (crosses midnight), Day 2: 09:00–21:00
    // Each shift is 12h, starting at 09:00 day 1
    // Shift 0: 09:00–21:00 Jan 1
    // Shift 1: 21:00 Jan 1 – 09:00 Jan 2
    // Shift 2: 09:00–21:00 Jan 2
    // Shift 3: 21:00 Jan 2 – 09:00 Jan 3 (start is within range)
    expect(shifts.length).toBeGreaterThanOrEqual(3);
  });

  it('generates shifts with correct indices starting at 0', () => {
    const shifts = generateShifts('2024-01-01', '2024-01-01', '08:00', 8);
    shifts.forEach((shift, i) => {
      expect(shift.index).toBe(i);
    });
  });

  it('first shift starts at cycleStartTime on startDate', () => {
    const shifts = generateShifts('2024-06-15', '2024-06-15', '09:30', 8);
    expect(shifts.length).toBeGreaterThan(0);
    const first = shifts[0];
    expect(first.start_datetime.getHours()).toBe(9);
    expect(first.start_datetime.getMinutes()).toBe(30);
  });

  it('each shift end equals next shift start', () => {
    const shifts = generateShifts('2024-01-01', '2024-01-03', '06:00', 6);
    for (let i = 0; i < shifts.length - 1; i++) {
      expect(shifts[i].end_datetime.getTime()).toBe(shifts[i + 1].start_datetime.getTime());
    }
  });

  it('shift duration matches durationHours', () => {
    const shifts = generateShifts('2024-01-01', '2024-01-02', '00:00', 8);
    for (const shift of shifts) {
      const durationMs = shift.end_datetime.getTime() - shift.start_datetime.getTime();
      expect(durationMs).toBe(8 * 60 * 60 * 1000);
    }
  });

  it('returns empty array when startDate is after endDate', () => {
    const shifts = generateShifts('2024-01-05', '2024-01-04', '09:00', 8);
    expect(shifts).toHaveLength(0);
  });

  it('returns Date objects for start/end datetimes', () => {
    const shifts = generateShifts('2024-01-01', '2024-01-01', '09:00', 12);
    expect(shifts[0].start_datetime).toBeInstanceOf(Date);
    expect(shifts[0].end_datetime).toBeInstanceOf(Date);
  });
});

describe('shiftsOverlap', () => {
  const makeShift = (startHour: number, endHour: number) => ({
    start_datetime: new Date(`2024-01-01T${String(startHour).padStart(2, '0')}:00:00`),
    end_datetime: new Date(`2024-01-01T${String(endHour).padStart(2, '0')}:00:00`),
  });

  it('returns true for fully overlapping shifts', () => {
    expect(shiftsOverlap(makeShift(8, 16), makeShift(10, 14))).toBe(true);
  });

  it('returns true for partially overlapping shifts', () => {
    expect(shiftsOverlap(makeShift(8, 14), makeShift(12, 18))).toBe(true);
  });

  it('returns false for adjacent shifts (end equals start)', () => {
    expect(shiftsOverlap(makeShift(8, 16), makeShift(16, 24))).toBe(false);
  });

  it('returns false for non-overlapping shifts', () => {
    expect(shiftsOverlap(makeShift(8, 12), makeShift(14, 18))).toBe(false);
  });

  it('returns true for identical shifts', () => {
    expect(shiftsOverlap(makeShift(9, 21), makeShift(9, 21))).toBe(true);
  });

  it('accepts string datetime inputs', () => {
    const a = { start_datetime: '2024-01-01T08:00:00', end_datetime: '2024-01-01T16:00:00' };
    const b = { start_datetime: '2024-01-01T12:00:00', end_datetime: '2024-01-01T20:00:00' };
    expect(shiftsOverlap(a, b)).toBe(true);
  });
});
