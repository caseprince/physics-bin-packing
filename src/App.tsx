
import { useEffect, useState } from "react";
import "./App.css";
import Box2DSim from "./Box2DSim";
import svgFile from "./svg/cat_faces.svg";


function App() {
  const [svgSource, setSvgSource] = useState<string>('')
  useEffect(() => {
    fetch(svgFile)
      .then((response) => response.text())
      .then((textContent) => {
        setSvgSource(textContent)
        // console.log(textContent)
      });
  })

  if (!svgSource) {
    return <div>loading...</div>
  }
  return <Box2DSim svg={svgSource} />
}
export default App;
