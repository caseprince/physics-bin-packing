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

function App() {
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // DEBUG BOXES:
  const shape = new b2PolygonShape();
  // shape.SetAsBox(10 / ZOOM, 10 / ZOOM);
  shape.Set([
    { x: 0, y: 0 },
    { x: 40 / ZOOM, y: 0 },
    { x: 0, y: 40 / ZOOM },
  ]);

  const fd: b2FixtureDef = {
    shape,
    density: 1,
    friction: 0.1,
  };

  const m_bodies = new Array<b2Body>(8);
  const m_indices = b2MakeNumberArray(8);

  for (let i = 0; i < 30; ++i) {
    m_indices[i] = i;
    const body = m_world.CreateBody({
      type: b2BodyType.b2_dynamicBody,
      position: { x: WIDTH / 2, y: (HEIGHT / 2 - 25 * i) / ZOOM },
      userData: m_indices[i],
    });

    m_bodies[i] = body;

    body.CreateFixture(fd);
  }

  const m_debugDraw = useRef<DebugDraw>();
  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

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
      positionIterations: 3,
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
