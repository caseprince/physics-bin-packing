
import { useEffect, useState } from "react";
import "./App.css";
import Box2DSim from "./Box2DSim";
// import svgFile from "./svg/cat_hubs.svg";
 import svgFile from "./svg/cat_faces.svg";
// import svgFile from "./svg/cat_faces2.svg";

function App() {
  const [svg, setSvg] = useState<SVGElement | null>(null)
  const [seed, setSeed] = useState(522)
  useEffect(() => {
    
    fetch(svgFile)
      .then((response) => response.text())
      .then((fileContent) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(fileContent, "application/xml");
        const svg = doc.getElementsByTagName("svg")[0]
        setSvg(svg)
    
        const errorNode = doc.querySelector("parsererror");
        if (errorNode) {
            console.log("error while parsing");
        }

      });
  }, [])

  if (!svg) {
    return <div>loading...</div>
  }

  const onChangeSeedInput: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    console.log(+e.currentTarget.value)
    setSeed(+e.currentTarget.value);
  }
  const bumpSeed = () => {
    // if (maxHeight.current < maxHeightBest.current) {
    //     maxHeightBest.current = maxHeight.current;
    //     console.log(`best seed: ${seed.current} height: ${maxHeight.current}`)
    // }        
    setSeed(seed + 1);
}
  
  const partCount = svg ? Array.from(svg.children).length : '-';
  console.log(partCount)
  return <div className="App">
    <Box2DSim svg={svg} seed={seed}/>
    <menu>
        <p>{partCount} Parts!</p>
        <p>Seed: <input type="text" onChange={onChangeSeedInput} value={seed}></input></p>                
        {/* <p>Max Height: {maxHeight.current}</p>
        <button onClick={() => {
            console.log("Pause!")
            setPaused(!paused)
            bodies.current.forEach(body => {
                // console.log(body.IsAwake()) // This seems to contradict the pink/grey debg UI state?
                body.SetAwake(false);
                // console.log(body.IsAwake())
                const draw = m_debugDraw.current;
                if (draw) {
                    DrawShapes(draw, m_world);
                }

            })
        }}>{paused ? "Resume Simulation" : "Pause Simulation"}</button>
        <br />
        <button onClick={() => {
            const svg = renderToString(<SVGOutput faceGroups={faceGroups} faceTransforms={faceTransforms.current} />);
            const blob = new Blob([svg], { type: 'application/json' });
            saveSVG(blob)
        }}>Download SVG</button>
        <br />
        <button onClick={() => {
            console.log("restart")
            resetFaceGeomsPosition()
        }}>Restart Simulation</button>*/}
        <button onClick={() => {
            bumpSeed()
        }}>Bump Seed</button> 
    </menu>
    
  </div>
}
export default App;
