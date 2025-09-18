import { useEffect, useRef, useState } from "react";
import "./App.css";
import Box2DSim from "./Box2DSim";
// import svgFile from "./svg/cat_hubs.svg";
import svgFile from "./svg/cat_faces.svg";
// import svgFile from "./svg/cat_faces2.svg";

function App() {
  const [svg, setSvg] = useState<SVGElement | null>(null);
  const [seed, setSeed] = useState(1);
  const [sheetWidth, setSheetWidth] = useState<number>(384);
  const [sheetHeight, setSheetHeight] = useState<number>(790);
  const seedRef = useRef(seed);
  const [autoBumpSeed, setAutoBumpSeed] = useState(true);
  const [bestSeeds, setBestSeeds] = useState<
    Array<{ seed: number; packHeight: number }>
  >([]);
  const [packHeight, setPackHeight] = useState(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const [timerResetKey, setTimerResetKey] = useState(0);
  const packHeightRef = useRef(packHeight);

  useEffect(() => {
    fetch(svgFile)
      .then((response) => response.text())
      .then((fileContent) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(fileContent, "application/xml");
        const svg = doc.getElementsByTagName("svg")[0];
        setSvg(svg);

        const errorNode = doc.querySelector("parsererror");
        if (errorNode) {
          console.log("error while parsing");
        }
      });
  }, []);

  const onChangeSeedInput: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setSeed(+e.currentTarget.value);
    // Reset the running bump/progress timers when the user manually changes seed.
    setTimerResetKey((k) => k + 1);
  };

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);
  useEffect(() => {
    packHeightRef.current = packHeight;
  }, [packHeight]);

  const bumpSeed = () => {
    // Before bumping, record the current seed/packHeight into bestSeeds.
    setBestSeeds((prev) => {
      const entry = {
        seed: seedRef.current,
        packHeight: packHeightRef.current,
      };
      console.log(entry);
      // If we have fewer than 5 entries, just add it.
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
      console.log("maxIdx, maxVal: " + maxIdx + ", " + maxVal);
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

  // Manage bump interval and a progress timer for the pie UI.
  useEffect(() => {
    const INTERVAL_MS = 15000; // interval duration in ms (matches bump interval)
    if (!autoBumpSeed) {
      setTimerProgress(0);
      return;
    }

    let start = Date.now();
    setTimerProgress(1);

    // progress tick updates UI more frequently
    const tickMs = 100;
    const progressId = setInterval(() => {
      const elapsed = Date.now() - start;
      const frac = Math.max(0, 1 - elapsed / INTERVAL_MS);
      setTimerProgress(frac);
    }, tickMs);

    // bump interval: call bumpSeed and reset progress/start time
    const bumpId = setInterval(() => {
      bumpSeed();
      start = Date.now();
      setTimerProgress(1);
    }, INTERVAL_MS);

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

  // useEffect(() => {
  //     const interval = setInterval(() => {
  //         bumpSeed()
  //     }, 30000)
  //     return () => clearInterval(interval)
  // }, [])

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
        <p>{partCount} Bodies!</p>
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
                // reset timers when checkbox triggers an immediate bump
                setTimerResetKey((k) => k + 1);
              }
              setAutoBumpSeed(e.currentTarget.checked);
            }}
            style={{ margin: 0 }}
          />
          Auto Bump Seed
          <svg viewBox="0 0 36 36" width={18} height={18} aria-hidden>
            <path
              d="M18 2.0845
                 a 15.9155 15.9155 0 0 1 0 31.831
                 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#000000"
              strokeWidth="4"
            />
            <path
              d="M18 2.0845
                 a 15.9155 15.9155 0 0 1 0 31.831
                 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={100}
              strokeDashoffset={Math.round((1 - timerProgress) * 100)}
              transform="rotate(-90 18 18)"
            />
          </svg>
        </label>
        {/* When autoBumpSeed is true, an interval will bump the seed every 5 seconds. */}
        <p>{`Pack Height: ${packHeight.toFixed(1)}mm`}</p>
        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: "6px 0" }}>Best Seeds</h4>
          {bestSeeds.length === 0 ? (
            <p style={{ margin: 0, fontStyle: "italic" }}>No saved seeds yet</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 4 }}>Seed</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Bin Height</th>
                </tr>
              </thead>
              <tbody>
                {bestSeeds.map((bs, idx) => (
                  <tr
                    key={`${bs.seed}-${idx}`}
                    onClick={() => {
                      setSeed(bs.seed);
                      setAutoBumpSeed(false);
                    }}
                    style={{
                      cursor: "pointer",
                      borderTop: "1px solid #6f6f6fff",
                    }}
                  >
                    <td style={{ padding: 6 }}>{bs.seed}</td>
                    <td style={{ padding: 6 }}>{`${bs.packHeight.toFixed(
                      1
                    )}mm`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </menu>
    </div>
  );
}
export default App;
