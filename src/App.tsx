import { useEffect, useRef, useState } from "react";
import "./App.css";
import Box2DSim from "./Box2DSim";
import catHubs from "./svg/cat_hubs.svg";
import catFaces from "./svg/cat_faces.svg";

// ----- Types & constants -----
type SvgOption = {
  label: string;
  svgSource: string;
  sheetWidth: number;
  sheetHeight: number;
};

type BestSeed = { seed: number; packHeight: number };

const BUMP_INTERVAL_MS = 15_000; // interval between automatic seed bumps
const PROGRESS_TICK_MS = 100; // UI refresh rate for timer progress

const svgOptions: Readonly<SvgOption[]> = [
  {
    label: "cat_faces",
    svgSource: catFaces,
    sheetWidth: 384,
    sheetHeight: 790,
  },
  { label: "cat_hubs", svgSource: catHubs, sheetWidth: 250, sheetHeight: 790 },
];

// ----- Small presentational components -----
function TimerProgress({ progress }: { progress: number }) {
  return (
    <svg viewBox="0 0 36 36" width={18} height={18} aria-hidden>
      <path
        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none"
        stroke="#000000"
        strokeWidth="4"
      />
      <path
        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={100}
        strokeDashoffset={Math.round((1 - progress) * 100)}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

function BestSeedsTable({
  items,
  onSelect,
}: {
  items: Readonly<BestSeed[]>;
  onSelect: (s: BestSeed) => void;
}) {
  if (items.length === 0) {
    return <p style={{ margin: 0, fontStyle: "italic" }}>No saved seeds yet.</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: 4 }}>Seed</th>
          <th style={{ textAlign: "left", padding: 4 }}>Pack Height</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row, idx) => (
          <tr
            key={`${row.seed}-${idx}`}
            onClick={() => onSelect(row)}
            style={{ cursor: "pointer", borderTop: "1px solid #6f6f6fff" }}
          >
            <td style={{ padding: 6 }}>{row.seed}</td>
            <td style={{ padding: 6 }}>{`${row.packHeight.toFixed(1)}mm`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ----- Helpers -----
async function fetchSvgElement(src: string): Promise<SVGElement> {
  const text = await fetch(src).then((r) => r.text());
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) {
    throw new Error("Error while parsing SVG");
  }
  const svgEl = doc.getElementsByTagName("svg")[0];
  if (!svgEl) throw new Error("SVG element not found");
  return svgEl;
}

function App() {
  const [selectedSvgIndex, setSelectedSvgIndex] = useState(0);
  const [svg, setSvg] = useState<SVGElement | null>(null);
  const [sheetWidth, setSheetWidth] = useState<number>(svgOptions[selectedSvgIndex].sheetWidth);
  const [sheetHeight, setSheetHeight] = useState<number>(svgOptions[selectedSvgIndex].sheetHeight);

  const [seed, setSeed] = useState(1);  
  const [autoBumpSeed, setAutoBumpSeed] = useState(true);
  const [bestSeeds, setBestSeeds] = useState<BestSeed[]>([]);
  const [packHeight, setPackHeight] = useState(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const [timerResetKey, setTimerResetKey] = useState(0);
  const packHeightRef = useRef(packHeight);

  useEffect(() => {
    // Load the currently selected SVG option.
    let disposed = false;
    const src = svgOptions[selectedSvgIndex].svgSource;
    setSvg(null);
    fetchSvgElement(src)
      .then((el) => {
        if (!disposed) setSvg(el);
      })
      .catch(() => {
        if (!disposed) setSvg(null);
      });
    return () => {
      disposed = true;
    };
  }, [selectedSvgIndex]);

  const onChangeSeedInput: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setSeed(+e.currentTarget.value);
    // Reset the running bump/progress timers when the user manually changes seed.
    setTimerResetKey((k) => k + 1);
  };

  useEffect(() => {
    packHeightRef.current = packHeight;
  }, [packHeight]);

  const bumpSeed = () => {
    // Before bumping, conditionally record the current seed/packHeight into bestSeeds.
    setBestSeeds((prev) => {
      const entry = {
        seed,
        packHeight: packHeightRef.current,
      };
      // If we have fewer than 10 entries, just add it.
      if (prev.length < 10) {
        return [...prev, entry].sort((a, b) => a.packHeight - b.packHeight);
      }
      // Otherwise, find the entry with the highest packHeight (worst) and replace it
      // only if the current packHeight is less than that (better is lower packHeight).
      let maxIdx = 0;
      let maxVal = prev[0].packHeight;
      for (let i = 1; i < prev.length; i++) {
        if (prev[i].packHeight > maxVal) {
          maxVal = prev[i].packHeight;
          maxIdx = i;
        }
      }
      // Replace the worst if current is better (smaller packHeight),
      // excluding duplicates (same seed and packHeight).
      if (
        entry.packHeight < maxVal &&
        !prev.some(
          (e) => e.seed === entry.seed && e.packHeight === entry.packHeight
        )
      ) {
        const copy = prev.slice();
        copy[maxIdx] = entry;
        return copy.sort((a, b) => a.packHeight - b.packHeight);
      }
      return prev;
    });

    setSeed((s) => s + 1);
    setTimerResetKey((k) => k + 1);
  };

  // Manage bump interval and a progress timer UI.
  useEffect(() => {
    if (!autoBumpSeed) {
      setTimerProgress(0);
      return;
    }

    let start = Date.now();
    setTimerProgress(1);

    const progressId = setInterval(() => {
      const elapsed = Date.now() - start;
      const frac = Math.max(0, 1 - elapsed / BUMP_INTERVAL_MS);
      setTimerProgress(frac);
    }, PROGRESS_TICK_MS);

    const bumpId = setInterval(() => {
      bumpSeed();
      start = Date.now();
      setTimerProgress(1);
    }, BUMP_INTERVAL_MS);

    return () => {
      clearInterval(progressId);
      clearInterval(bumpId);
      setTimerProgress(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBumpSeed, timerResetKey]);

  if (!svg) {
    return <div>loading...</div>;
  }

  const partCount = svg ? Array.from(svg.children).length : "-";

  return (
    <div className="App">
      <Box2DSim
        svg={svg}
        seed={seed}
        reportPackHeight={setPackHeight}
        sheetWidth={sheetWidth}
        sheetHeight={sheetHeight}
      />
      <menu>
        <div style={{ marginBottom: 8 }}>
          <label>
            Source:
            <select
              value={selectedSvgIndex}
              onChange={(e) => {
                const idx = +e.currentTarget.value;
                setSelectedSvgIndex(idx);
                setSheetWidth(svgOptions[idx].sheetWidth);
                setSheetHeight(svgOptions[idx].sheetHeight);
              }}
              style={{ marginLeft: 8, height: 22 }}
            >
              {svgOptions.map((opt, i) => (
                <option key={opt.label} value={i}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ marginRight: 12 }}>
            Sheet Width (mm):
            <input
              type="number"
              value={sheetWidth}
              onChange={(e) => setSheetWidth(+e.currentTarget.value)}
              style={{ width: 80, marginLeft: 8 }}
            />
          </label>
          <label>
            Sheet Height (mm):
            <input
              type="number"
              value={sheetHeight}
              onChange={(e) => setSheetHeight(+e.currentTarget.value)}
              style={{ width: 80, marginLeft: 8 }}
            />
          </label>
        </div>
        <p>{partCount} Parts!</p>
        <p>
          Seed:{" "}
          <input type="text" onChange={onChangeSeedInput} value={seed}></input>
        </p>
        <button onClick={() => bumpSeed()}>Bump Seed</button>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          <input
            type="checkbox"
            checked={autoBumpSeed}
            onChange={(e) => {
              if (e.currentTarget.checked) {
                bumpSeed();
                // Reset timers when checkbox triggers an immediate bump
                setTimerResetKey((k) => k + 1);
              }
              setAutoBumpSeed(e.currentTarget.checked);
            }}
            style={{ margin: 0 }}
          />
          Auto Bump Seed
          <TimerProgress progress={timerProgress} />
        </label>
        <p>{`Pack Height: ${packHeight.toFixed(1)}mm`}</p>
        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: "6px 0" }}>Best Seeds</h4>
          <BestSeedsTable
            items={bestSeeds}
            onSelect={(row) => {
              setSeed(row.seed);
              setAutoBumpSeed(false);
            }}
          />
        </div>
      </menu>
    </div>
  );
}
export default App;
