import { memo, useEffect, useRef } from "react";
import { renderToString } from "react-dom/server";

import {
  b2Body,
  b2BodyType,
  b2EdgeShape,
  b2Fixture,
  b2LinearStiffness,
  b2MouseJoint,
  b2MouseJointDef,
  b2PolygonShape,
  b2Vec2,
  b2World,
  DrawJoints,
  DrawShapes,
} from "@box2d/core";
import type { b2FixtureDef, XY } from "@box2d/core";
import { DebugDraw } from "@box2d/debug-draw";
import Stats from "stats.js";
import Prando from "prando";

const SCALE_FACTOR = 4; // Controls scale of units in physics world. Box2D is optimized for a certain scale.
const WIDTH = 1000;
const HEIGHT = 1000;

interface IPartTransform {
  x: number;
  y: number;
  rotation: number;
}

const Box2DSim = memo(
  ({
    svg,
    seed,
    reportPackHeight,
    sheetWidth,
    sheetHeight,
  }: {
    svg: SVGElement;
    seed: number;
    reportPackHeight: (height: number) => void;
    sheetWidth: number;
    sheetHeight: number;
  }) => {
    console.log("Render Box2DSim");
    const debugCanvasRef = useRef<HTMLCanvasElement>(null);
    const debugDrawRef = useRef<DebugDraw | null>(null);
    const statsRef = useRef<Stats | null>(null);
    const faceTransforms = useRef<IPartTransform[]>([]);
    const animationFrameLoop = useRef(0);

    useEffect(() => {
      const debugCanvas = debugCanvasRef.current;
      if (debugCanvas) {
        initSim();

        const m_ctx = debugCanvasRef.current?.getContext("2d");
        if (!m_ctx)
          throw new Error("Could not create 2d context for debug-draw");
        if (!debugDrawRef.current) {
          debugDrawRef.current = new DebugDraw(m_ctx);
        }
        debugDrawRef.current.Prepare(
          WIDTH / 2,
          HEIGHT / 2,
          SCALE_FACTOR,
          false
        );

        if (!statsRef.current) {
          statsRef.current = new Stats();
          statsRef.current.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
          document.body.appendChild(statsRef.current.dom);
        }

        debugCanvas.addEventListener("mousedown", handleMouseDown);
        debugCanvas.addEventListener("mouseup", handleMouseUp);
        debugCanvas.addEventListener("mousemove", handleMouseMove);

        animationFrameLoop.current = window.requestAnimationFrame(loop);
      }
      return () => {
        debugDrawRef.current?.Finish();

        debugCanvas?.removeEventListener("mousedown", handleMouseDown);
        debugCanvas?.removeEventListener("mouseup", handleMouseUp);
        debugCanvas?.removeEventListener("mousemove", handleMouseMove);

        window.cancelAnimationFrame(animationFrameLoop.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seed, sheetWidth, sheetHeight]);

    let bodies: b2Body[] = [];

    const positionBodies = () => {
      const rng = new Prando(seed);
      const bodiesToRandomSort = [...bodies];
      bodiesToRandomSort.sort(
        (a, b) => a.GetUserData().index - b.GetUserData().index
      );
      bodiesToRandomSort.sort(() => rng.next(-1, 1));
      const COLS = 8;
      const ROW_SPACING = 42;
      bodiesToRandomSort.forEach((body, i) => {
        body.SetTransformXY(
          WIDTH / 2 - 25 + ((i % COLS) / COLS) * 55,
          (HEIGHT * 2.4 - ROW_SPACING * (Math.floor(i / COLS) + 1)) /
            SCALE_FACTOR,
          0
        );
        body.ApplyTorque(20);
        body.SetAngularVelocity(0);
        body.SetLinearVelocity({ x: 0, y: 0 });
        body.SetAwake(true);
        body.SetAngle(0);
      });
    };

    let faceGroups: Element[] = [];
    let m_world: b2World;
    let ground: b2Body;

    const initSim = () => {
      console.log("initSim!");
      const gravity: XY = { x: 0, y: 9 };
      m_world = b2World.Create(gravity);
      m_world.SetAllowSleeping(true);
      m_world.SetWarmStarting(true);
      m_world.SetContinuousPhysics(true);
      m_world.SetSubStepping(false); // TODO: experiment
      ground = m_world.CreateBody();

      // m_world.ClearForces(); // Resetting to be triggered by parent?

      // compute sheet sizes (convert mm to physics units)
      const sheetW = sheetWidth / SCALE_FACTOR;
      const sheetH = sheetHeight / SCALE_FACTOR;

      const offSetX = sheetW / -2 + WIDTH / 2;
      const offSetY = sheetH / -2 + HEIGHT / 2;
      const shape = new b2EdgeShape();

      // left bin wall
      shape.SetTwoSided(
        new b2Vec2(offSetX, offSetY),
        new b2Vec2(offSetX, sheetH + offSetY)
      );
      ground.CreateFixture({ shape });

      // right bin wall
      shape.SetTwoSided(
        new b2Vec2(sheetW + offSetX, offSetY),
        new b2Vec2(sheetW + offSetX, sheetH + offSetY)
      );
      ground.CreateFixture({ shape });

      // bottom bin floor
      shape.SetTwoSided(
        new b2Vec2(offSetX, sheetH + offSetY),
        new b2Vec2(sheetW + offSetX, sheetH + offSetY)
      );
      ground.CreateFixture({ shape });

      const smashBody = m_world.CreateBody();
      const smashShape = new b2PolygonShape();
      smashShape.SetAsBox(sheetW, 100, { x: WIDTH / 2, y: HEIGHT / 20 });
      const smashFix: b2FixtureDef = {
        shape: smashShape,
        density: 10.12,
        friction: 0.0055,
      };
      smashBody.CreateFixture(smashFix);

      // https://stackoverflow.com/questions/3680876/using-queryselectorall-to-retrieve-direct-children
      // faceGroups = Array.from(svg.querySelectorAll(":scope > g"));
      faceGroups = Array.from(svg.children);

      const hitBoxPathSummedLengths: number[] = [];
      bodies = [];
      faceGroups.forEach((faceGroup, i) => {
        const body = m_world.CreateBody({
          type: b2BodyType.b2_dynamicBody,
          position: { x: 0, y: 0 },
          userData: { index: i },
        });
        bodies.push(body);
        hitBoxPathSummedLengths.push(0);
        // HITBOX PATHS
        const hitBoxPaths = faceGroup.querySelectorAll("g.hitboxes > path");
        hitBoxPaths.forEach((path, i) => {
          const dParts = path.getAttribute("d")?.split(" ") || [];
          /* EG: [
              "M",
              "30.3539465789905",
              "-14.8089705308746",
              "L",
              "0.045809654247714", // Loop from index 4!
              "-24.6159674447546",
              "L",
              "0.045809633959952",
              "-1.93172136715616",
              "L",
              "30.3539465789905",
              "-14.8089705308746"
          ]*/

          const polygonPoints: Array<{ x: number; y: number }> = [];
          for (let d = 4; d < dParts.length; d += 3) {
            polygonPoints.push({ x: +dParts[d], y: +dParts[d + 1] }); // "L"
          }
          if (polygonPoints.length > 7) {
            console.warn(
              "Warning! Hitboxes with more than 7 control points will be truncated!"
            );
          }

          for (let p = 0; p < polygonPoints.length; p++) {
            const point1 = polygonPoints[p];
            const point2 = polygonPoints[(p + 1) % polygonPoints.length];
            const xDif = point1.x - point2.x;
            const yDif = point1.y - point2.y;
            hitBoxPathSummedLengths[i] += Math.sqrt(xDif * xDif + yDif * yDif);
          }

          const shape = new b2PolygonShape();
          shape.Set(
            polygonPoints.map((point) => ({
              x: point.x / SCALE_FACTOR,
              y: point.y / SCALE_FACTOR,
            }))
          );
          const fd: b2FixtureDef = {
            shape,
            density: 0.22,
            friction: 0.0004,
          };

          body.CreateFixture(fd);
        });

        // HITBOX RECTS
        const hitBoxRects = faceGroup.querySelectorAll("g.hitboxes > rect");
        hitBoxRects.forEach((rect) => {
          const x = +(rect.getAttribute("x") as string) / SCALE_FACTOR;
          const y = +(rect.getAttribute("y") as string) / SCALE_FACTOR;
          const width = +(rect.getAttribute("width") as string) / SCALE_FACTOR;
          const height =
            +(rect.getAttribute("height") as string) / SCALE_FACTOR;
          const transform = rect.getAttribute("transform");
          let rotation = 0;
          if (transform) {
            rotation = +transform.split("rotate(")[1].slice(0, -1); // this is gross but regex is hard
          }
          let center = { x: x + width / 2, y: y + height / 2 };
          if (rotation) {
            center = rotateAroundOrigin(
              center.x,
              center.y,
              degreesToRadians(-rotation)
            );
          }
          const shape = new b2PolygonShape();
          shape.SetAsBox(
            width / 2,
            height / 2,
            center,
            degreesToRadians(rotation)
          );

          const fd: b2FixtureDef = {
            shape,
            density: 0.12,
            friction: 0.0055,
          };

          body.CreateFixture(fd);
        });
      });

      positionBodies();
    };

    // LOOP
    const loop = () => {
      statsRef.current?.begin();
      const m_ctx = debugCanvasRef.current?.getContext("2d");
      if (m_ctx) {
        m_ctx.clearRect(0, 0, m_ctx.canvas.width, m_ctx.canvas.height);
      }

      m_world.Step(1 / 30, {
        velocityIterations: 8,
        positionIterations: 9,
      });
      const draw = debugDrawRef.current;
      if (draw) {
        DrawShapes(draw, m_world);
        DrawJoints(draw, m_world);
      }

      let minY = 1000;
      bodies.forEach((body) => {
        const fix = body.GetFixtureList();
        const lowerY = fix?.GetAABB(0).lowerBound.y || 0;
        if (lowerY < minY) {
          minY = lowerY;
        }
      });

      reportPackHeight(1000 - minY);

      if (bodies.some((body) => body.IsAwake())) {
        faceTransforms.current = bodies.map((body) => {
          const pos = body.GetPosition();
          const angle = body.GetAngle();
          return {
            x: pos.x * SCALE_FACTOR - 1500,
            y: pos.y * SCALE_FACTOR - 1500,

            rotation: radiansToDegrees(angle),
          };
        });
      }

      try {
        animationFrameLoop.current = window.requestAnimationFrame(loop);
      } catch (e) {
        console.error("Error during simulation loop", e);
      }
      statsRef.current?.end();
    };

    let m_mouseJoint: b2MouseJoint | null = null;
    const handleMouseDown = (e: MouseEvent): void => {
      // left mouse button
      if (e.button === 0) {
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
          console.log(`Dragging Body index: ${body.GetUserData().index}`);
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
      return new b2Vec2(
        WIDTH / 2 + xDiff / SCALE_FACTOR,
        HEIGHT / 2 + yDiff / SCALE_FACTOR
      );
    };
    const handleMouseUp = (): void => {
      if (m_mouseJoint) {
        m_world.DestroyJoint(m_mouseJoint);
        m_mouseJoint = null;
      }
    };

    return (
      <div className="App">
        <canvas ref={debugCanvasRef} width={WIDTH} height={HEIGHT} />
        {/* Live SVG Preview? */}
        {/* <SVGOutput
        faceGroups={faceGroups}
        faceTransforms={faceTransforms.current}
      /> */}
        <menu className="sim-menu">
          {/* <button
          onClick={() => {
            console.log("Pause!", paused);
            bodies.forEach((body, i) => {
                if (i !== 0) {
                    body.SetAwake(paused);
                }
              const draw = debugDrawRef.current;
              if (draw) {
                DrawShapes(draw, m_world);
              }
            });
            setPaused(!paused);
          }}
        >
          {paused ? "Resume Simulation" : "Pause Simulation"}
        </button>
        <br /> */}
          <p>
            <em>Click and drag parts for fun! ↝</em>
          </p>
          <button
            onClick={() => {
              const svgString = renderToString(
                <SVGOutput
                  faceGroups={faceGroups}
                  faceTransforms={faceTransforms.current}
                />
              );
              const blob = new Blob([svgString], { type: "application/json" });
              saveSVG(blob);
            }}
          >
            Download SVG
          </button>
        </menu>
      </div>
    );
  }
);

const SVGOutput = ({
  faceGroups,
  faceTransforms,
}: {
  faceGroups?: Array<Element>;
  faceTransforms: IPartTransform[];
}) => (
  <svg
    width="1000mm"
    height="1000mm"
    viewBox="0 0 1000 1000"
    xmlns="http://www.w3.org/2000/svg"
  >
    {(faceGroups || []).map((faceGroup, i) => {
      const transform = faceTransforms[i];

      // const rects = Array.from(faceGroup.querySelectorAll("> rect"));
      // const paths = Array.from(faceGroup.querySelectorAll("> path"));
      const toolpaths = Array.from(faceGroup.children).filter((child) => {
        // console.log(child.className)
        // console.log(child.classList)
        return !Array.from(child.classList).includes("hitboxes");
      });

      // // Unify input paths with one Line or Arc per, into single part outline path
      // const paths = faceGroup.querySelectorAll("path");
      // // Grab first path's "M 12.34" command: (The only one we need!)
      // let unifiedPathD = paths[0].getAttribute("d")?.split(" L ")[0] || "";
      // paths.forEach(path => {
      //     // Accumulate the lines and arcs, assuming intermediate "M"oves are redundant. :u)
      //     const d = path.getAttribute("d") || "";
      //     let lineTo = d.includes(" L ") ? ` L ${d.split(" L ")[1]}` : "";
      //     let arcTo = d.includes(" A ") ? ` A ${d.split(" A ")[1]}` : "";
      //     unifiedPathD += lineTo + arcTo;
      // })
      // var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      // path.setAttribute("d", unifiedPathD)
      // const children = [...paths, ...rects] // Filters out g.hitboxes

      const textElements = faceGroup.querySelectorAll("text");
      // Pad labels with left & right ~ to enable simple DOM searching for complete numbers with devtools:
      const dataLabels = Array.from(textElements)
        .map((element) => `~${element.textContent}~`)
        .join(",");
      return (
        <g
          key={`face${i}`}
          data-labels={dataLabels}
          stroke="blue"
          strokeWidth={0.3}
          fill="none"
          transform={`translate(${transform?.x || 20}, ${
            transform?.y || 80
          }) rotate(${transform?.rotation || 0})`}
          dangerouslySetInnerHTML={{
            __html: toolpaths.map((child) => child.outerHTML).join(""),
          }}
        ></g>
      );
    })}
  </svg>
);

function radiansToDegrees(radians: number) {
  return radians * (180 / Math.PI);
}
function degreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

function rotateAroundOrigin(x: number, y: number, radians: number) {
  // """Only rotate a point around the origin (0, 0)."""
  const xx = x * Math.cos(radians) + y * Math.sin(radians);
  const yy = -x * Math.sin(radians) + y * Math.cos(radians);

  return { x: xx, y: yy };
}

const saveSVG = async (blob: Blob) => {
  const a = document.createElement("a");
  a.download = "output.svg"; // TODO: Match input SVG name
  a.href = URL.createObjectURL(blob);
  a.addEventListener("click", () => {
    setTimeout(() => URL.revokeObjectURL(a.href), 30 * 1000);
  });
  a.click();
};

export default Box2DSim;
