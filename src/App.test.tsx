/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders loading state initially', () => {
    render(<App />);
    expect(screen.getByText(/loading.../i)).toBeInTheDocument();
  })
});
