import { render, screen } from '@testing-library/react';
import App from './App';

// react-calendar ships ESM-only, which Jest 27 (CRA) does not transform.
jest.mock('react-calendar', () => ({
  __esModule: true,
  default: () => null,
}));

test('renders the landing page', () => {
  window.history.pushState({}, '', '/');
  render(<App />);

  expect(screen.getAllByText(/aquallera/i).length).toBeGreaterThan(0);
});
