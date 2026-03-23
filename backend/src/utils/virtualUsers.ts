import { randomUUID } from 'crypto';

export const VIRTUAL_EMAIL_DOMAIN = 'shiftsync.internal';

export function generateVirtualEmail(): string {
  return `virtual-${randomUUID()}@${VIRTUAL_EMAIL_DOMAIN}`;
}

export function isVirtualEmail(email: string): boolean {
  return email.endsWith(`@${VIRTUAL_EMAIL_DOMAIN}`);
}

export type UpgradeValidationError =
  | 'email_required'
  | 'team_required'
  | 'email_change_not_allowed';

export function validateUpgrade(params: {
  existingIsVirtual: boolean;
  isUpgrade: boolean;
  email: string | undefined;
  teamId: number | null | undefined;
}): UpgradeValidationError | null {
  const { existingIsVirtual, isUpgrade, email, teamId } = params;

  if (!existingIsVirtual && email !== undefined) {
    return 'email_change_not_allowed';
  }

  if (isUpgrade) {
    if (!email) return 'email_required';
    if (teamId == null) return 'team_required';
  }

  return null;
}
