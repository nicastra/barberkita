import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HealthResponse } from './api/health';
import App from './App';

const { getHealthMock } = vi.hoisted(() => ({
  getHealthMock: vi.fn(),
}));

vi.mock('./api/health', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api/health')>();
  return { ...original, getHealth: getHealthMock };
});

const healthyResponse: HealthResponse = {
  status: 'ok',
  services: { api: 'ok', database: 'ok' },
  timestamp: '2026-08-30T08:00:00.000Z',
};

describe('application shell', () => {
  beforeEach(() => {
    getHealthMock.mockReset();
  });

  it('shows a loading state while checking connectivity', () => {
    getHealthMock.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(
      screen.getByText('Checking API and database connectivity…'),
    ).toBeInTheDocument();
  });

  it('shows the connected state when the API and database are healthy', async () => {
    getHealthMock.mockResolvedValue(healthyResponse);

    render(<App />);

    expect(await screen.findByText('Operational')).toBeInTheDocument();
    expect(
      screen.getByText('All foundation services are connected.'),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText('Connected')).toHaveLength(2);
  });

  it('shows a recoverable error state when the API cannot be reached', async () => {
    getHealthMock.mockRejectedValue(new Error('Network unavailable'));

    render(<App />);

    expect(await screen.findByText('Connection issue')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
});
