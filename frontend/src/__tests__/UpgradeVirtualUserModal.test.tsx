import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpgradeVirtualUserModal from '../components/UpgradeVirtualUserModal';
import type { Team, User } from '../types';

const mockUser: User = {
  id: 42,
  name: 'Ghost Worker',
  email: 'virtual-abc@shiftsync.internal',
  is_admin: false,
  is_virtual: true,
  team_id: null,
  created_at: '',
};

const mockTeams: Team[] = [
  { id: 1, name: 'Alpha Team', created_at: '' },
  { id: 2, name: 'Beta Team', created_at: '' },
];

function renderModal(overrides: Partial<Parameters<typeof UpgradeVirtualUserModal>[0]> = {}) {
  const props = {
    user: mockUser,
    teams: mockTeams,
    onClose: vi.fn(),
    onSave: vi.fn(),
    isSaving: false,
    ...overrides,
  };
  return { ...render(<UpgradeVirtualUserModal {...props} />), props };
}

describe('UpgradeVirtualUserModal', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the user name in the description', () => {
    renderModal();
    expect(screen.getByText(/Ghost Worker/)).toBeInTheDocument();
  });

  it('renders email input and team select', () => {
    renderModal();
    expect(screen.getByPlaceholderText('user@company.com')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders all team options plus the placeholder', () => {
    renderModal();
    expect(screen.getByRole('option', { name: 'Select a team…' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alpha Team' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta Team' })).toBeInTheDocument();
  });

  it('disables Upgrade button when email is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Upgrade User' })).toBeDisabled();
  });

  it('disables Upgrade button when team is not selected', async () => {
    renderModal();
    await userEvent.type(screen.getByPlaceholderText('user@company.com'), 'real@company.com');
    expect(screen.getByRole('button', { name: 'Upgrade User' })).toBeDisabled();
  });

  it('disables Upgrade button when email has no @ symbol', async () => {
    renderModal();
    await userEvent.type(screen.getByPlaceholderText('user@company.com'), 'notanemail');
    await userEvent.selectOptions(screen.getByRole('combobox'), '1');
    expect(screen.getByRole('button', { name: 'Upgrade User' })).toBeDisabled();
  });

  it('enables Upgrade button when both email and team are filled', async () => {
    renderModal();
    await userEvent.type(screen.getByPlaceholderText('user@company.com'), 'real@company.com');
    await userEvent.selectOptions(screen.getByRole('combobox'), '1');
    expect(screen.getByRole('button', { name: 'Upgrade User' })).toBeEnabled();
  });

  it('calls onSave with email and teamId when submitted', async () => {
    const { props } = renderModal();
    await userEvent.type(screen.getByPlaceholderText('user@company.com'), 'real@company.com');
    await userEvent.selectOptions(screen.getByRole('combobox'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Upgrade User' }));
    expect(props.onSave).toHaveBeenCalledWith('real@company.com', 2);
  });

  it('calls onClose when Cancel is clicked', async () => {
    const { props } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when X button is clicked', async () => {
    const { props } = renderModal();
    await userEvent.click(screen.getByLabelText('Close'));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('shows Upgrading… text while saving', () => {
    renderModal({ isSaving: true });
    expect(screen.getByRole('button', { name: 'Upgrading…' })).toBeInTheDocument();
  });

  it('disables buttons while saving', () => {
    renderModal({ isSaving: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('displays error message when provided', () => {
    renderModal({ error: 'Email already exists' });
    expect(screen.getByText('Email already exists')).toBeInTheDocument();
  });

  it('does not display error when error is null', () => {
    renderModal({ error: null });
    expect(screen.queryByText('Email already exists')).not.toBeInTheDocument();
  });
});
