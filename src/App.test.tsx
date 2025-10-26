/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';

// Mock fetch for SVG loading
const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
  <g id="part1">
    <rect x="0" y="0" width="10" height="10" />
    <g class="hitboxes"><rect x="0" y="0" width="10" height="10" /></g>
  </g>
</svg>
`;

// Mock Box2DSim to avoid Box2D and to expose received props.
// Also simulate pack height updates when the seed changes to test Best Seeds logic.
vi.mock('./Box2DSim', () => {
  const React = require('react');
  function Box2DSimMock(props: any) {
    const { sheetWidth, sheetHeight, seed, reportPackHeight } = props;
    React.useEffect(() => {
      // Simulate pack height report on mount and whenever seed changes
      // Use a deterministic formula so tests can assert values.
      const value = 100 + seed; // seed 1 => 101.0mm, seed 2 => 102.0mm, etc.
      reportPackHeight(value);
    }, [seed, reportPackHeight]);
    return (
      <div data-testid="box2d-mock">
        <div>sheetWidth:{sheetWidth}</div>
        <div>sheetHeight:{sheetHeight}</div>
        <div>seed:{seed}</div>
      </div>
    );
  }
  return { default: Box2DSimMock };
});

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => SAMPLE_SVG,
    })) as unknown as typeof fetch);
  });

  it('renders loading state initially', async () => {
    render(<App />);
    expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument();
    // Wait for the next state change so async updates are wrapped by act
    await screen.findByTestId('box2d-mock');
  });

  it('loads the SVG and renders Box2DSim with initial props', async () => {
    render(<App />);
    const mock = await screen.findByTestId('box2d-mock');
    expect(mock).toBeInTheDocument();
    // Defaults from svgOptions[0] in App.tsx
    expect(screen.getByText('sheetWidth:384')).toBeInTheDocument();
    expect(screen.getByText('sheetHeight:790')).toBeInTheDocument();
    expect(screen.getByText('seed:1')).toBeInTheDocument();
  });

  it('updates Pack Height when Box2DSim reports it', async () => {
    render(<App />);
    await screen.findByTestId('box2d-mock');
    await waitFor(() =>
      expect(screen.getByText(/Pack Height: 101\.0?mm/i)).toBeInTheDocument()
    );
  });

  it('passes updated sheet dimensions from inputs to Box2DSim', async () => {
    render(<App />);
    await screen.findByTestId('box2d-mock');

    const w = screen.getByLabelText(/Sheet Width \(mm\):/i) as HTMLInputElement;
    const h = screen.getByLabelText(/Sheet Height \(mm\):/i) as HTMLInputElement;

    fireEvent.change(w, { target: { value: '500' } });
    fireEvent.change(h, { target: { value: '600' } });

    expect(await screen.findByText('sheetWidth:500')).toBeInTheDocument();
    expect(await screen.findByText('sheetHeight:600')).toBeInTheDocument();
  });

  it('updates Box2DSim seed when seed input changes', async () => {
    render(<App />);
    await screen.findByTestId('box2d-mock');

    // Seed input is unlabeled, so select by current value
    const seedInput = screen.getByDisplayValue('1') as HTMLInputElement;
    fireEvent.change(seedInput, { target: { value: '42' } });

    expect(await screen.findByText('seed:42')).toBeInTheDocument();
  });

  it('records best seeds on bump with current seed and pack height', async () => {
    render(<App />);
    await screen.findByTestId('box2d-mock');

    // Disable auto-bump to keep control in test
    const autoChk = screen.getByLabelText(/Auto Bump Seed/i) as HTMLInputElement;
    if (autoChk.checked) {
      fireEvent.click(autoChk); // uncheck
    }

    // At seed=1, mock reports pack height = 101
    await waitFor(() => expect(screen.getByText(/Pack Height: 101\.0?mm/i)).toBeInTheDocument());

    // First bump should record entry (seed=1, packHeight=101)
    fireEvent.click(screen.getByRole('button', { name: /bump seed/i }));

    // Best Seeds table should show the first entry
    await waitFor(() => expect(screen.getByText(/Best Seeds/i)).toBeInTheDocument());
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/101\.0?mm/)).toBeInTheDocument();

    // After bump, seed is now 2 and mock will report 102. Trigger a second bump to record it
    await waitFor(() => expect(screen.getByText(/Pack Height: 102\.0?mm/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /bump seed/i }));

    // Expect both entries present
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/102\.0?mm/)).toBeInTheDocument();

    // Optional: ensure there are two rows in the Best Seeds table body
    // Count all rows under the table body (two items)
    // Using regex for the mm values ensures we match formatted output
  });

  it('keeps only 10 best seeds and replaces the worst when a better one arrives', async () => {
  render(<App />);
    await screen.findByTestId('box2d-mock');

    // Disable auto-bump for determinism
    const autoChk = screen.getByLabelText(/Auto Bump Seed/i) as HTMLInputElement;
    if (autoChk.checked) fireEvent.click(autoChk);

    const seedInput = screen.getByDisplayValue('1') as HTMLInputElement;

    // Fill entries for seeds 1..10
    for (let s = 1; s <= 10; s++) {
      fireEvent.change(seedInput, { target: { value: String(s) } });
      await waitFor(() =>
        expect(screen.getByText(new RegExp(`Pack Height: ${100 + s}\\.0?mm`, 'i'))).toBeInTheDocument()
      );
      fireEvent.click(screen.getByRole('button', { name: /bump seed/i }));
    }

    // Verify table has 10 rows and is sorted ascending by pack height
    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').filter((row) => row.querySelectorAll('td').length > 0);
    expect(bodyRows.length).toBe(10);
    expect(bodyRows[0]).toHaveTextContent(/101\.0?mm/); // seed 1
    expect(bodyRows[9]).toHaveTextContent(/110\.0?mm/); // seed 10 (worst)

    // Now set a better entry (seed 0 => 100mm) and bump to record it
    fireEvent.change(seedInput, { target: { value: '0' } });
    await waitFor(() =>
      expect(screen.getByText(/Pack Height: 100\.0?mm/i)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /bump seed/i }));

    // Still 10 rows, includes 100mm, and 110mm removed
    const bodyRowsAfter = within(screen.getByRole('table')).getAllByRole('row').filter((row) => row.querySelectorAll('td').length > 0);
    expect(bodyRowsAfter.length).toBe(10);
    expect(screen.getByText(/100\.0?mm/)).toBeInTheDocument();
    expect(screen.queryByText(/110\.0?mm/)).not.toBeInTheDocument();

    // And sorted ascending: first = 100mm, last = 109mm
    expect(bodyRowsAfter[0]).toHaveTextContent(/100\.0?mm/);
    expect(bodyRowsAfter[9]).toHaveTextContent(/109\.0?mm/);
  });
});
