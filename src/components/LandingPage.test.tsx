import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';

vi.mock('next/link', () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children: ReactNode;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('LandingPage', () => {
  it('renders a minimal landing screen with a linked wordmark', () => {
    render(<LandingPage />);

    expect(screen.getByText('EgoLift')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'EgoLift' })).toHaveAttribute('href', '/app?tab=today');
  });
});
