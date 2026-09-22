import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

describe('provider route guard', () => {
  it('blocks an unauthenticated browser visit from rendering provider screens', async () => {
    render(
      <MemoryRouter initialEntries={['/provider']}>
        <Routes>
          <Route element={<ProtectedRoute user={null} ready providerOnly />}>
            <Route path="/provider" element={<p>Provider dashboard</p>} />
          </Route>
          <Route path="/sign-in" element={<p>Sign in</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Provider dashboard')).not.toBeInTheDocument();
    expect(await screen.findByText('Sign in')).toBeInTheDocument();
  });
});
