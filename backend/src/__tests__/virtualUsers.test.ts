import { describe, it, expect } from 'vitest';
import {
  generateVirtualEmail,
  isVirtualEmail,
  validateUpgrade,
  VIRTUAL_EMAIL_DOMAIN,
} from '../utils/virtualUsers';

describe('generateVirtualEmail', () => {
  it('returns an email ending with the virtual domain', () => {
    const email = generateVirtualEmail();
    expect(email).toMatch(/@shiftsync\.internal$/);
  });

  it('returns an email starting with "virtual-"', () => {
    const email = generateVirtualEmail();
    expect(email).toMatch(/^virtual-/);
  });

  it('generates unique emails on each call', () => {
    const emails = new Set(Array.from({ length: 10 }, () => generateVirtualEmail()));
    expect(emails.size).toBe(10);
  });

  it('contains a UUID between the prefix and domain', () => {
    const email = generateVirtualEmail();
    // UUID v4 pattern: 8-4-4-4-12 hex chars
    expect(email).toMatch(
      /^virtual-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@shiftsync\.internal$/
    );
  });
});

describe('isVirtualEmail', () => {
  it('returns true for virtual domain emails', () => {
    expect(isVirtualEmail(`virtual-abc@${VIRTUAL_EMAIL_DOMAIN}`)).toBe(true);
  });

  it('returns false for real emails', () => {
    expect(isVirtualEmail('user@gmail.com')).toBe(false);
    expect(isVirtualEmail('admin@company.com')).toBe(false);
  });

  it('returns false for emails that partially match the domain', () => {
    expect(isVirtualEmail('user@notsiftsync.internal')).toBe(false);
  });
});

describe('validateUpgrade', () => {
  const baseParams = {
    existingIsVirtual: true,
    isUpgrade: true,
    email: 'real@company.com',
    teamId: 1,
  };

  it('returns null when all upgrade params are valid', () => {
    expect(validateUpgrade(baseParams)).toBeNull();
  });

  it('returns email_required when upgrading without an email', () => {
    expect(validateUpgrade({ ...baseParams, email: undefined })).toBe('email_required');
  });

  it('returns team_required when upgrading without a team_id', () => {
    expect(validateUpgrade({ ...baseParams, teamId: null })).toBe('team_required');
  });

  it('returns team_required when upgrading with undefined team_id', () => {
    expect(validateUpgrade({ ...baseParams, teamId: undefined })).toBe('team_required');
  });

  it('returns email_required before team_required (email checked first)', () => {
    expect(validateUpgrade({ ...baseParams, email: undefined, teamId: null })).toBe('email_required');
  });

  it('returns email_change_not_allowed when setting email on a real user', () => {
    expect(
      validateUpgrade({
        existingIsVirtual: false,
        isUpgrade: false,
        email: 'new@company.com',
        teamId: 1,
      })
    ).toBe('email_change_not_allowed');
  });

  it('returns null when no email provided for a real user (no-op)', () => {
    expect(
      validateUpgrade({
        existingIsVirtual: false,
        isUpgrade: false,
        email: undefined,
        teamId: 1,
      })
    ).toBeNull();
  });

  it('returns null for a non-upgrade edit on a virtual user (e.g. name change only)', () => {
    expect(
      validateUpgrade({
        existingIsVirtual: true,
        isUpgrade: false,
        email: undefined,
        teamId: undefined,
      })
    ).toBeNull();
  });
});
