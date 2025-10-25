import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders loading state initially', () => {
  render(<App />);
  expect(screen.getByText(/loading.../i)).toBeInTheDocument();
});
