import { useEffect, useRef } from "react";
import "./App.css";
import {
  b2Body,
  b2BodyType,
  b2EdgeShape,
  b2FixtureDef,
  b2MakeNumberArray,
  b2PolygonShape,
  b2Vec2,
  b2World,
  DrawShapes,
  XY,
} from "@box2d/core";
import { DebugDraw } from "@box2d/debug-draw";
import Stats from "stats.js";

const SHEET_WIDTH = 384;
const SHEET_HEIGHT = 790;
const PADDING = 20;

function App() {
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  const gravity: XY = { x: 0, y: 100 };
  const m_world: b2World = b2World.Create(gravity);

  const ground = m_world.CreateBody();
  {
    const offSetX = PADDING;
    const offSetY = PADDING;
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

  const shape = new b2PolygonShape();
  shape.SetAsBox(10, 10);

  const fd: b2FixtureDef = {
    shape,
    density: 1,
    friction: 0.1,
  };

  const m_bodies = new Array<b2Body>(8);
  const m_indices = b2MakeNumberArray(8);

  for (let i = 0; i < 8; ++i) {
    m_indices[i] = i;
    const body = m_world.CreateBody({
      type: b2BodyType.b2_dynamicBody,
      position: { x: 50, y: 400 - 25 * i },
      userData: m_indices[i],
    });

    m_bodies[i] = body;

    body.CreateFixture(fd);
  }

  const m_debugDraw = useRef<DebugDraw>();

  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

  useEffect(() => {
    const debugCanvas = debugCanvasRef.current;
    if (debugCanvas) {
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

        m_world.Step(1 / 120, {
          velocityIterations: 8,
          positionIterations: 3,
        });
        if (m_debugDraw.current) {
          DrawShapes(m_debugDraw.current, m_world);
        }

        try {
          window.requestAnimationFrame(loop);
        } catch (e) {
          console.error("Error during simulation loop", e);
        }
        stats.end();
      };
      const init = () => {
        document.body.appendChild(stats.dom);
        const m_ctx = debugCanvas.getContext("2d");
        if (!m_ctx)
          throw new Error("Could not create 2d context for debug-draw");
        m_debugDraw.current = new DebugDraw(m_ctx);
        window.requestAnimationFrame(loop);
      };
      window.requestAnimationFrame(init);
    }
  });

  console.log("render");
  return (
    <div className="App">
      <header className="App-header">Hello Box2d</header>
      <canvas ref={debugCanvasRef} width="1000" height={1000} />
    </div>
  );
}

export default App;
