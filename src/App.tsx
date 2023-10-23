import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  b2Body,
  b2BodyType,
  b2CircleShape,
  b2EdgeShape,
  b2Fixture,
  b2FixtureDef,
  b2LinearStiffness,
  b2MakeNumberArray,
  b2MouseJoint,
  b2MouseJointDef,
  b2PolygonShape,
  b2Vec2,
  b2World,
  DrawJoints,
  DrawShapes,
  DrawAABBs,
  XY,
} from "@box2d/core";
import { DebugDraw } from "@box2d/debug-draw";
import Stats from "stats.js";
import svgFile from "./svg/cat.svg";
import { svg } from "./svg/cat"

const ZOOM = 4;
let SHEET_WIDTH = 384;
let SHEET_HEIGHT = 790;
let PADDING = 20;
SHEET_WIDTH /= ZOOM;
SHEET_HEIGHT /= ZOOM;
PADDING /= ZOOM;

const WIDTH = 1000;
const HEIGHT = 1000;

const DEBUG_SVG = `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
<g class="face" fill="none" stroke="blue" stroke-width="0.1">
<path d="M 41.1969 11.0853 L 2.0854 96.3152"/>
<path d="M 2.0854 96.3152 A 1.0925 1.0925 167.675 0 1 1.2e-14 95.8596"/>
<path d="M 1.2e-14 95.8596 L 1.9e-15 61.2937"/>
<path d="M 1.9e-15 61.2937 A 13.3655 13.3655 110.5107 0 1 3.2817 52.5214"/>
<path d="M 3.2817 52.5214 L 40.0005 10.3132"/>
<path d="M 40.0005 10.3132 A 0.7192 0.7192 171.8143 0 1 41.1969 11.0853"/>
<rect x="-2.45" y="4.1043" width="4.7" height="4.2" transform="translate(23.8044,51.8735) rotate(114.6501)" />
<g transform="translate(23.8044,51.8735) rotate(114.6501)">
    <text transform="translate(0,6.2043) rotate(-90)" x="0" y="-5" font-family="Times New Roman" font-size="3" stroke="black" dominant-baseline="middle" text-anchor="middle">2</text>
</g>
<rect x="-2.45" y="3.9288" width="4.7" height="4.2" transform="translate(23.8044,27.3631) rotate(311.0215)" />
<g transform="translate(23.8044,27.3631) rotate(311.0215)">
    <text transform="translate(0,6.0288) rotate(90)" x="0" y="-5" font-family="Times New Roman" font-size="3" stroke="black" dominant-baseline="middle" text-anchor="middle">1</text>
</g>
</g>
<g class="face" fill="none" stroke="blue" stroke-width="0.1">
<path d="M 45.6979 4.421 L 4.184 67.685"/>
<path d="M 4.184 67.685 A 1.494 1.494 163.3635 0 1 1.4408 66.8654"/>
<path d="M 1.4408 66.8654 L 1.4408 12.5686"/>
<path d="M 1.4408 12.5686 A 5.84 5.84 130.5691 0 1 6.3812 6.7983"/>
<path d="M 6.3812 6.7983 L 43.5007 1.0109"/>
<path d="M 43.5007 1.0109 A 2.2191 2.2191 156.0673 0 1 45.6979 4.421"/>
<rect x="-2.45" y="4.0586" width="4.7" height="4.2" transform="translate(24.9924,38.0865) rotate(123.2729)" />
<g transform="translate(24.9924,38.0865) rotate(123.2729)">
    <text transform="translate(0,6.1586) rotate(90)" x="0" y="-5" font-family="Times New Roman" font-size="3" stroke="black" dominant-baseline="middle" text-anchor="middle">3</text>
</g>
<rect x="-2.45" y="4.3408" width="4.7" height="4.2" transform="translate(7.1e-15,41.9831) rotate(270.0)" />
<g transform="translate(7.1e-15,41.9831) rotate(270.0)">
    <text transform="translate(0,6.4408) rotate(-90)" x="0" y="-5" font-family="Times New Roman" font-size="3" stroke="black" dominant-baseline="middle" text-anchor="middle">4</text>
</g>
</g>
<g class="face" fill="none" stroke="blue" stroke-width="0.1">
<path d="M 59.4935 29.4665 L 4.614 52.379"/>
<path d="M 4.614 52.379 A 3.3308 3.3308 146.3304 0 1 0.0 49.3054"/>
<path d="M 0.0 49.3054 L 0.0 6.2277"/>
<path d="M 0.0 6.2277 A 3.3526 3.3526 146.1576 0 1 4.6255 3.1263"/>
<path d="M 4.6255 3.1263 L 59.482 25.6416"/>
<path d="M 59.482 25.6416 A 2.0698 2.0698 157.512 0 1 59.4935 29.4665"/>
<rect x="-2.45" y="3.9288" width="4.7" height="4.2" transform="translate(33.4685,41.4469) rotate(157.3392)" />
<g transform="translate(33.4685,41.4469) rotate(157.3392)">
    <text transform="translate(0,6.0288) rotate(-90)" x="0" y="-5" font-family="Times New Roman" font-size="3" stroke="black" dominant-baseline="middle" text-anchor="middle">1</text>
</g>
<rect x="-2.45" y="4.0358" width="4.7" height="4.2" transform="translate(33.4685,13.7368) rotate(22.3153)" />
<g transform="translate(33.4685,13.7368) rotate(22.3153)">
    <text transform="translate(0,6.1358) rotate(90)" x="0" y="-5" font-family="Times New Roman" font-size="3" stroke="black" dominant-baseline="middle" text-anchor="middle">5</text>
</g>
</g>
</svg>`;





interface IPoint { x: number; y: number }

// const offsetPolygonPoints = function (points: IPoint[], gapRadiusRatio: number) {

//   points.forEach((pointA, i) => {
//     let indexB = i + 1;
//     if (indexB == points.length) {
//       indexB = 0
//     }
//     let indexC = i + 2
//     if (indexC >= points.length) {
//       indexC -= points.length
//     }
//     let indexD = i - 1
//     if (indexD < 0) {
//       indexD = points.length - 1

//       const pointB = points[indexB]
//       const pointC = points[indexC]
//       const pointD = points[indexD]
//     }
//     console.log("indexes", i, indexB, indexC, indexD)

//     const gapRadius = 10

//     const ADdiff = [pointD.x - pointA.x, pointD.y - pointA.y]
//     const angleDAB = getAngle((pointD.x, pointD.y), (pointA.x, pointA.y), (pointB.x, pointB.y))
//     const ADdist = gapRadius / Math.sin(Math.radians(angleDAB))
//     const lengthAD = rs.Distance(convert2Dpt(pointA), convert2Dpt(pointD))
//     const ADratio = ADdist / lengthAD
//     const newA = {x: pointA.x + ADdiff[0] * ADratio, y: pointA.y + ADdiff.y * ADratio}
//     points[i] = newA

//     const BCDiff = [(]pointC.x - pointB.x, pointC.y - pointB.y]
//     const angleCBA = getAngle((pointA.x, pointA.y), (pointB.x, pointB.y), (pointC.x, pointC.y))
//     const BCdist = gapRadius / math.sin(math.radians(angleCBA))
//     const lengthBC = rs.Distance(convert2Dpt(pointB), convert2Dpt(pointC))
//     const BCratio = BCdist / lengthBC
//     const newB = {x: pointB.x + BCDiff[0] * BCratio, y: pointB.y + BCDiff[1] * BCratio)}
//     points[indexB] = newB

//   })
// }







function App() {
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const m_debugDraw = useRef<DebugDraw>();
  const [faceTransforms, setFaceTransforms] = useState<
    { x: Number; y: Number; rotation: number }[]
  >([]);

  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

  // const [svgSource, setSvgSource] = useState<string>('')
  // useEffect(() => {
  //   fetch(svgFile)
  //     .then((response) => response.text())
  //     .then((textContent) => {
  //       setSvgSource(textContent)
  //       console.log(textContent)
  //     });
  // }, [])
  // if (!svgSource) {
  //   return null;
  // }

  let faceGroups: NodeListOf<Element> | undefined = undefined
  let faceGeoms: {
    polygonPoints: {
      x: number;
      y: number;
    }[]
  }[] = [];
  if (svg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "application/xml");
    // print the name of the root element or error message
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      console.log("error while parsing");
    }
    // } else {
    //   console.log(doc.documentElement);
    // }

    faceGroups = doc.documentElement.querySelectorAll("svg > g.face");
    faceGeoms = Array.from(faceGroups).map((faceGroup) => {
      const paths = faceGroup.querySelectorAll("path");
      const lines = Array.from(paths).filter((path) =>
        path.getAttribute("d")?.includes(" L ")
      );
      const polygonPoints: Array<{ x: number; y: number }> = [];
      lines.forEach((line, i) => {
        const dParts = line.getAttribute("d")?.split(" ") || [];
        // Square off rounded corners (inaccurately!)
        // if (dParts?.length) {
        //   polygonPoints.push({ x: +dParts[1], y: +dParts[2] }); // "M"
        //   polygonPoints.push({ x: +dParts[4], y: +dParts[5] }); // "L"
        // }

        const nextLineIndex = (i + 1) % lines.length;
        const nextLine = lines[nextLineIndex];
        const dParts2 = nextLine.getAttribute("d")?.split(" ") || [];
        const intersection = intersect(
          +dParts[1],
          +dParts[2],
          +dParts[4],
          +dParts[5],
          +dParts2[1],
          +dParts2[2],
          +dParts2[4],
          +dParts2[5]
        );
        if (intersection) {
          polygonPoints.push(intersection);
        } else {
          console.error("Parallel lines!?");
        }
      });

      // # (rx ry angle large-arc-flag sweep-flag x y)
      // Rounded corner circles can be too big for skinny triangles, and also kill FPS
      // const circles = Array.from(paths)
      //   .filter((path) => path.getAttribute("d")?.includes(" A "))
      //   .map((path) => {
      //     const dParts = path.getAttribute("d")?.split(" ");
      //     return { radius: (dParts && +dParts[4]) as number };
      //   });

      return { polygonPoints };
    });
  }
  // console.log(faceGeoms);


  const gravity: XY = { x: 0, y: 100 };
  const m_world: b2World = b2World.Create(gravity);

  const ground = m_world.CreateBody();
  {
    const offSetX = SHEET_WIDTH / -2 + WIDTH / 2;
    const offSetY = SHEET_HEIGHT / -2 + HEIGHT / 2;
    const shape = new b2EdgeShape();

    // left
    shape.SetTwoSided(
      new b2Vec2(offSetX, offSetY),
      new b2Vec2(offSetX, SHEET_HEIGHT + offSetY)
    );
    ground.CreateFixture({ shape });

    // right
    shape.SetTwoSided(
      new b2Vec2(SHEET_WIDTH + offSetX, offSetY),
      new b2Vec2(SHEET_WIDTH + offSetX, SHEET_HEIGHT + offSetY)
    );
    ground.CreateFixture({ shape });

    // bottom
    shape.SetTwoSided(
      new b2Vec2(offSetX, SHEET_HEIGHT + offSetY),
      new b2Vec2(SHEET_WIDTH + offSetX, SHEET_HEIGHT + offSetY)
    );
    ground.CreateFixture({ shape });
  }

  //const DEBUG_FACE_COUNT = 3;
  const bodies: b2Body[] = [];
  let x = 1;
  //for (let x = 1; x < DEBUG_FACE_COUNT; x += faceGeoms.length) {
  faceGeoms.forEach((faceGeom, i) => {
    if (i > 10) {
      return
    }
    const shape = new b2PolygonShape();
    // shape.SetAsBox(10 / ZOOM, 10 / ZOOM);
    shape.Set(
      faceGeom.polygonPoints.map((point) => ({
        x: point.x / ZOOM,
        y: point.y / ZOOM,
      }))
    );
    const fd: b2FixtureDef = {
      shape,
      density: 1,
      friction: 0.01,
    };
    const body = m_world.CreateBody({
      type: b2BodyType.b2_dynamicBody,
      position: { x: WIDTH / 2, y: (HEIGHT / 2 - 8 * (i + x)) / ZOOM },
      // userData: m_indices[i],
    });
    body.CreateFixture(fd);
    bodies.push(body);
  });
  //}

  // LOOP
  const [maxHeightOffset, setMaxHeightOffset] = useState(0); // Highest part's top edge (?) 
  const loop = () => {
    stats.begin();

    let minY = 1000000
    bodies.forEach((body, i) => {
      const fix = body.GetFixtureList()
      const upperY = fix?.GetAABB(0).lowerBound.y
      if (upperY && minY > upperY) {
        minY = upperY
      }
      if (i == 0) {
        // console.log(upperY)
      }
    })

    if (Math.round(minY) > Math.round(maxHeightOffset)) {
      setMaxHeightOffset(Math.round(minY))
    }

    const m_ctx = debugCanvasRef.current?.getContext("2d");
    if (m_ctx) {
      m_ctx.clearRect(0, 0, m_ctx.canvas.width, m_ctx.canvas.height);
    }

    m_world.SetAllowSleeping(true);
    m_world.SetWarmStarting(true);
    m_world.SetContinuousPhysics(true);
    m_world.SetSubStepping(false);

    m_world.Step(1 / 60, {
      velocityIterations: 18,
      positionIterations: 19,
    });
    const draw = m_debugDraw.current;
    if (draw) {
      DrawShapes(draw, m_world);
      DrawJoints(draw, m_world);
      // DrawAABBs(draw, m_world);
    }

    const SVG_RENDER = false;
    if (SVG_RENDER && bodies.some((body) => body.IsAwake())) {
      setFaceTransforms(
        bodies.map((body) => {
          const pos = body.GetPosition();
          const angle = body.GetAngle();
          return {
            x: pos.x * ZOOM - 1500,
            y: pos.y * ZOOM - 1500,

            rotation: radiansToDegrees(angle),
          };
        })
      );
    }

    try {
      window.requestAnimationFrame(loop);
    } catch (e) {
      console.error("Error during simulation loop", e);
    }
    stats.end();
  };

  useEffect(() => {
    const debugCanvas = debugCanvasRef.current;
    if (debugCanvas && !m_debugDraw.current) {
      console.log("init!");
      document.body.appendChild(stats.dom);

      debugCanvas.addEventListener("mousedown", (e) => handleMouseDown(e));
      debugCanvas.addEventListener("mouseup", (e) => handleMouseUp(e));
      debugCanvas.addEventListener("mousemove", (e) => handleMouseMove(e));

      const m_ctx = debugCanvas.getContext("2d");
      if (!m_ctx) throw new Error("Could not create 2d context for debug-draw");
      const draw = new DebugDraw(m_ctx);
      // draw.Prepare(500 / ZOOM, 500 / ZOOM, 1 / ZOOM, false);
      draw.Prepare(WIDTH / 2, HEIGHT / 2, ZOOM, false);
      m_debugDraw.current = draw;

      window.requestAnimationFrame(loop);
    }
  });

  let m_mouseJoint: b2MouseJoint | null = null;
  const handleMouseDown = (e: MouseEvent): void => {
    // left mouse button
    if (e.button === 0) {
      //const p = new b2Vec2(e.offsetX, e.offsetY);
      const p = unProjectMouseEvent(e);

      if (m_mouseJoint !== null) {
        m_world.DestroyJoint(m_mouseJoint);
        m_mouseJoint = null;
      }

      let hit_fixture: b2Fixture | undefined;

      // Query the world for overlapping shapes.
      m_world.QueryPointAABB(p, (fixture) => {
        const body = fixture.GetBody();
        if (body.GetType() === b2BodyType.b2_dynamicBody) {
          const inside = fixture.TestPoint(p);
          if (inside) {
            hit_fixture = fixture;
            return false; // We are done, terminate the query.
          }
        }
        return true; // Continue the query.
      });

      if (hit_fixture) {
        const frequencyHz = 5;
        const dampingRatio = 0.7;

        const body = hit_fixture.GetBody();
        const md = new b2MouseJointDef();
        md.bodyA = ground;
        md.bodyB = body;
        md.target.Copy(p);
        md.maxForce = 1000 * body.GetMass();
        b2LinearStiffness(md, frequencyHz, dampingRatio, md.bodyA, md.bodyB);

        m_mouseJoint = m_world.CreateJoint(md) as b2MouseJoint;
        body.SetAwake(true);
      }
    }
  };
  const handleMouseMove = (e: MouseEvent): void => {
    if (m_mouseJoint !== null) {
      const p = unProjectMouseEvent(e);
      m_mouseJoint.SetTarget(p);
    }
  };
  const unProjectMouseEvent = (e: MouseEvent): b2Vec2 => {
    const xDiff = e.offsetX - WIDTH / 2;
    const yDiff = e.offsetY - HEIGHT / 2;
    return new b2Vec2(WIDTH / 2 + xDiff / ZOOM, HEIGHT / 2 + yDiff / ZOOM);
  };
  const handleMouseUp = (e: MouseEvent): void => {
    if (m_mouseJoint) {
      m_world.DestroyJoint(m_mouseJoint);
      m_mouseJoint = null;
    }
  };

  console.log("render App");
  return (
    <div className="App">
      <canvas ref={debugCanvasRef} width="1000" height={1000} />
      <svg
        width={1000}
        height={1000}
        viewBox="0 0 1000 1000"
        xmlns="http://www.w3.org/2000/svg"
      >
        {Array.from(faceGroups || []).map((group, i) => {
          const transform = faceTransforms[i];
          return (
            <g
              key={`face${i}`}
              stroke="blue"
              transform={`translate(${transform?.x || 20}, ${transform?.y || 80}) rotate(${transform?.rotation || 0})`}
              dangerouslySetInnerHTML={{
                __html: group.innerHTML,
              }}
            />
          );
        })}
      </svg>
      <menu>
        <p>{faceGeoms.length} Parts</p>
        <p>Max Height: {maxHeightOffset}</p>
        <button onClick={() => {
          console.log("Pause!")
          bodies.forEach(body => {
            console.log(body.IsAwake())
            body.SetAwake(false);
            console.log(body.IsAwake())
            const draw = m_debugDraw.current;
            if (draw) {
              DrawShapes(draw, m_world);
            }

          })
        }}>Pause Simlulation</button>
      </menu>
    </div>
  );
}

// line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
// Determine the intersection point of two line segments
// Return FALSE if the lines don't intersect
function intersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
) {
  // Check if none of the lines are of length 0
  if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
    return false;
  }

  const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

  // Lines are parallel
  if (denominator === 0) {
    return false;
  }

  let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
  // let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

  // is the intersection along the segments
  // if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
  //   return false;
  // }

  // Return a object with the x and y coordinates of the intersection
  let x = x1 + ua * (x2 - x1);
  let y = y1 + ua * (y2 - y1);

  return { x, y };
}

function radiansToDegrees(radians: number) {
  return radians * (180 / Math.PI);
}

export default App;
