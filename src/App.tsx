import { useEffect, useState } from "react";
import "./App.css";
import Box2DSim from "./Box2DSim";
// import svgFile from "./svg/cat_hubs.svg";
import svgFile from "./svg/cat_faces.svg";
// import svgFile from "./svg/cat_faces2.svg";

function App() {
  const [svg, setSvg] = useState<SVGElement | null>(null);
  const [seed, setSeed] = useState(522);
  const [binHeight, setBinHeight] = useState(0);
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

  if (!svg) {
    return <div>loading...</div>;
  }

  const onChangeSeedInput: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    console.log(+e.currentTarget.value);
    setSeed(+e.currentTarget.value);
  };
  const bumpSeed = () => {
    setSeed(seed + 1);
  };

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
        <button
          onClick={() => {
            bumpSeed();
          }}
        >
          Bump Seed
        </button>
        <p>{`Bin Height: ${binHeight.toFixed(1)}`}</p>
      </menu>
    </div>
  );
}
export default App;
