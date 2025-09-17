import { useEffect, useRef, useState } from "react";
import "./App.css";
import Box2DSim from "./Box2DSim";
// import svgFile from "./svg/cat_hubs.svg";
import svgFile from "./svg/cat_faces.svg";
// import svgFile from "./svg/cat_faces2.svg";

function App() {
  const [svg, setSvg] = useState<SVGElement | null>(null);
  const [seed, setSeed] = useState(1);
  const seedRef = useRef(seed);
  const [autoBumpSeed, setAutoBumpSeed] = useState(true);
  const [bestSeeds, setBestSeeds] = useState<
    Array<{ seed: number; binHeight: number }>
  >([]);
  const [binHeight, setBinHeight] = useState(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const binHeightRef = useRef(binHeight);

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
    console.log(+e.currentTarget.value);
    setSeed(+e.currentTarget.value);
  };

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);
  useEffect(() => {
    binHeightRef.current = binHeight;
  }, [binHeight]);

  const bumpSeed = () => {
    // Before bumping, record the current seed/binHeight into bestSeeds.
    setBestSeeds((prev) => {
      const entry = { seed: seedRef.current, binHeight: binHeightRef.current };
      console.log(entry);
      // If we have fewer than 5 entries, just add it.
      if (prev.length < 10) {
        return [...prev, entry].sort((a, b) => a.binHeight - b.binHeight);
      }
      // Otherwise, find the entry with the highest binHeight (worst) and replace it
      // only if the current binHeight is less than that (better is lower binHeight).
      let maxIdx = 0;
      let maxVal = prev[0].binHeight;
      for (let i = 1; i < prev.length; i++) {
        if (prev[i].binHeight > maxVal) {
          maxVal = prev[i].binHeight;
          maxIdx = i;
        }
      }
      console.log("maxIdx, maxVal: " + maxIdx + ", " + maxVal);
      // Replace the worst if current is better (smaller binHeight),
      // excluding duplicates (same seed and binHeight).
      if (
        binHeight < maxVal &&
        !prev.some(
          (e) => e.seed === entry.seed && e.binHeight === entry.binHeight
        )
      ) {
        const copy = prev.slice();
        copy[maxIdx] = entry;
        return copy.sort((a, b) => a.binHeight - b.binHeight);
      }
      return prev;
    });

    setSeed((s) => s + 1);
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
  }, [autoBumpSeed]);

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
      <Box2DSim svg={svg} seed={seed} reportBinHeight={setBinHeight} />
      <menu>
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
              stroke="#eee"
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
        <p>{`Bin Height: ${binHeight.toFixed(1)}`}</p>
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
                    <td style={{ padding: 6 }}>{bs.binHeight.toFixed(1)}</td>
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
