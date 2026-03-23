import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShiftCell from '../components/ShiftCell';

describe('ShiftCell', () => {
  it('renders the correct label for in_shift state', () => {
    render(<ShiftCell state="in_shift" hasPendingRequest={false} />);
    expect(screen.getByText('In Shift')).toBeInTheDocument();
  });

  it('renders the correct label for available state', () => {
    render(<ShiftCell state="available" hasPendingRequest={false} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('renders the correct label for home state', () => {
    render(<ShiftCell state="home" hasPendingRequest={false} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('shows pending badge when hasPendingRequest is true', () => {
    render(<ShiftCell state="available" hasPendingRequest={true} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('hides pending badge when hasPendingRequest is false', () => {
    render(<ShiftCell state="available" hasPendingRequest={false} />);
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });

  it('calls onClick when admin clicks the cell', async () => {
    const onClick = vi.fn();
    render(<ShiftCell state="available" hasPendingRequest={false} isAdmin onClick={onClick} />);
    await userEvent.click(screen.getByText('Available').closest('div')!);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick for non-admin', async () => {
    const onClick = vi.fn();
    render(<ShiftCell state="available" hasPendingRequest={false} isAdmin={false} onClick={onClick} />);
    await userEvent.click(screen.getByText('Available').closest('div')!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<ShiftCell state="available" hasPendingRequest={false} isAdmin disabled onClick={onClick} />);
    await userEvent.click(screen.getByText('Available').closest('div')!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies green styles for in_shift state', () => {
    const { container } = render(<ShiftCell state="in_shift" hasPendingRequest={false} />);
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toContain('bg-green-100');
  });

  it('applies red styles for home state', () => {
    const { container } = render(<ShiftCell state="home" hasPendingRequest={false} />);
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toContain('bg-red-100');
  });
});
