import { useEffect, useRef } from "react";
import "./App.css";
import {
  b2Body,
  b2BodyType,
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
  XY,
} from "@box2d/core";
import { DebugDraw } from "@box2d/debug-draw";
import Stats from "stats.js";

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
<path d="M 60.9764 28.8474 L 4.614 52.379"/>
<path d="M 4.614 52.379 A 3.3308 3.3308 146.3304 0 1 0.0 49.3054"/>
<path d="M 0.0 49.3054 L 0.0 5.0"/>
<path d="M 0.0 5.0 A 3.3526 3.3526 146.1576 0 1 4.6255 1.8985"/>
<path d="M 4.6255 1.8985 L 60.9648 25.0225"/>
<path d="M 60.9648 25.0225 A 2.0698 2.0698 157.512 0 1 60.9764 28.8474"/>
<rect x="-2.45" y="3.9288" width="4.7" height="4.2" transform="translate(33.4685,41.4469) rotate(157.3392)" />
<g transform="translate(33.4685,41.4469) rotate(157.3392)">
    <text transform="translate(0,6.0288) rotate(-90)" x="0" y="-5" font-family="Times New Roman" font-size="3" stroke="black" dominant-baseline="middle" text-anchor="middle">1</text>
</g>
</g>
<g class="face" fill="none" stroke="blue" stroke-width="0.1">
<path d="M 41.1969 11.0853 L 2.0854 96.3152"/>
<path d="M 2.0854 96.3152 A 1.0925 1.0925 167.675 0 1 -1.2e-14 95.8596"/>
<path d="M -1.2e-14 95.8596 L -1.9e-15 61.2937"/>
<path d="M -1.9e-15 61.2937 A 13.3655 13.3655 110.5107 0 1 3.2817 52.5214"/>
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
<path d="M 58.2708 93.7015 L 4.9951 91.3309"/>
<path d="M 4.9951 91.3309 A 5.2274 5.2274 133.7261 0 1 -6.7e-15 86.1086"/>
<path d="M -6.7e-15 86.1086 L -5.6e-16 7.1222"/>
<path d="M -5.6e-16 7.1222 A 1.556 1.556 162.7135 0 1 2.8373 6.2393"/>
<path d="M 2.8373 6.2393 L 60.4286 89.8067"/>
<path d="M 60.4286 89.8067 A 2.4863 2.4863 153.5604 0 1 58.2708 93.7015"/>
<rect x="-2.45" y="4.1043" width="4.7" height="4.2" transform="translate(32.3874,46.9954) rotate(55.4269)" />
<g transform="translate(32.3874,46.9954) rotate(55.4269)">
    <text transform="translate(0,6.2043) rotate(90)" x="0" y="-5" font-family="Times New Roman" font-size="3" stroke="black" dominant-baseline="middle" text-anchor="middle">2</text>
</g>
</g>
</svg>`;

const parser = new DOMParser();
const doc = parser.parseFromString(DEBUG_SVG, "application/xml");
// print the name of the root element or error message
const errorNode = doc.querySelector("parsererror");
if (errorNode) {
  console.log("error while parsing");
} else {
  console.log(doc.documentElement);
}

const facesGroups = doc.documentElement.querySelectorAll("svg > g.face");
const faceLinePoints = Array.from(facesGroups).map((faceGroup) => {
  const paths = faceGroup.querySelectorAll("path");
  const lines = Array.from(paths).filter((path) =>
    path.getAttribute("d")?.includes(" L ")
  );
  const points: Array<{ x: number; y: number }> = [];
  lines.forEach((line) => {
    const dParts = line.getAttribute("d")?.split(" ");
    if (dParts?.length) {
      points.push({ x: +dParts[1], y: +dParts[2] }); // "M"
      points.push({ x: +dParts[4], y: +dParts[5] }); // "L"
    }
  });
  return points;
});
console.log(faceLinePoints);

function App() {
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const m_debugDraw = useRef<DebugDraw>();
  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

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

  for (let x = 1; x < 120; x += faceLinePoints.length) {
    faceLinePoints.forEach((facePoints, i) => {
      const shape = new b2PolygonShape();
      // shape.SetAsBox(10 / ZOOM, 10 / ZOOM);
      shape.Set(
        facePoints.map((point) => ({ x: point.x / ZOOM, y: point.y / ZOOM }))
      );

      const fd: b2FixtureDef = {
        shape,
        density: 1,
        friction: 0.1,
      };
      const body = m_world.CreateBody({
        type: b2BodyType.b2_dynamicBody,
        position: { x: WIDTH / 2, y: (HEIGHT / 2 - 105 * (i + x)) / ZOOM },
        // userData: m_indices[i],
      });
      body.CreateFixture(fd);
    });
  }

  // LOOP
  const loop = () => {
    stats.begin();

    const m_ctx = debugCanvasRef.current?.getContext("2d");
    if (m_ctx) {
      m_ctx.clearRect(0, 0, m_ctx.canvas.width, m_ctx.canvas.height);
    }

    m_world.SetAllowSleeping(true);
    m_world.SetWarmStarting(true);
    m_world.SetContinuousPhysics(true);
    m_world.SetSubStepping(false);

    m_world.Step(1 / 60, {
      velocityIterations: 8,
      positionIterations: 9,
    });
    const draw = m_debugDraw.current;
    if (draw) {
      DrawShapes(draw, m_world);
      DrawJoints(draw, m_world);
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
      // const init = () => {
      console.log("init");
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

      // };
      // window.requestAnimationFrame(init);
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
      <header className="App-header">Hello Box2d</header>
      <canvas ref={debugCanvasRef} width="1000" height={1000} />
    </div>
  );
}

export default App;
