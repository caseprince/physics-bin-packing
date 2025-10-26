/// <reference types="vitest/globals" />
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

// Limit the RAF-driven loop to a single iteration per render to avoid infinite recursion in tests
let rafCalls = 0;
const rafSpy = vi
  .spyOn(window, 'requestAnimationFrame')
  .mockImplementation((cb: FrameRequestCallback): number => {
    if (rafCalls++ < 1) cb(0 as any);
    return rafCalls;
  });
const cafSpy = vi
  .spyOn(window, 'cancelAnimationFrame')
  .mockImplementation((_id: number) => {});

// Provide a minimal canvas 2D context for jsdom
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype as any, 'getContext').mockImplementation(
    (_type: string) => ({
      canvas: { width: 1000, height: 1000 },
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
  );
  // Polyfill URL blob helpers if missing in jsdom
  if (!(URL as any).createObjectURL) {
    (URL as any).createObjectURL = vi.fn(() => 'blob:polyfill');
  }
  if (!(URL as any).revokeObjectURL) {
    (URL as any).revokeObjectURL = vi.fn();
  }
});

// Minimal DOM measurement helpers for canvas events
Object.defineProperty(HTMLElement.prototype, 'offsetLeft', { get: () => 0 });
Object.defineProperty(HTMLElement.prototype, 'offsetTop', { get: () => 0 });

// Mocks for third-party libs used by Box2DSim
vi.mock('@box2d/debug-draw', () => {
  class DebugDraw {
    constructor(_ctx: CanvasRenderingContext2D) {}
    Prepare = vi.fn();
    Finish = vi.fn();
  }
  return { DebugDraw };
});
vi.mock('stats.js', () => {
  return {
    default: class Stats {
      dom = (() => {
        const d = document.createElement('div');
        d.setAttribute('data-stats', '1');
        return d;
      })();
      showPanel = vi.fn();
      begin = vi.fn();
      end = vi.fn();
    },
  };
});

// Box2D core mock with just enough surface for Box2DSim
let lastCreatedJoint: any = null;
let createdWorlds: any[] = [];

vi.mock('@box2d/core', () => {
  const bodies: any[] = [];

  class b2Vec2 {
    constructor(public x: number, public y: number) {}
    Copy(v: any) {
      this.x = v.x; this.y = v.y;
      return this;
    }
  }

  class b2EdgeShape {
    SetTwoSided(_a: b2Vec2, _b: b2Vec2) {}
  }

  class b2PolygonShape {
    Set(_pts: any[]) {}
    SetAsBox(_w: number, _h: number, _center?: any, _angle?: number) {}
  }

  const b2BodyType = {
    b2_staticBody: 0,
    b2_kinematicBody: 1,
    b2_dynamicBody: 2,
  } as const;

  class FakeFixture {
    constructor(private body: any, private aabbY: number) {}
    GetBody() { return this.body; }
    TestPoint(_p: any) { return true; }
    GetAABB(_idx: number) {
      return { lowerBound: { y: this.aabbY } };
    }
  }

  class b2Body {
    private type = b2BodyType.b2_dynamicBody;
    private userData: any = {};
    private angle = 0;
    private awake = false;
    private pos = { x: 0, y: 0 };
    private fixtures: any[] = [];
    private firstFixture: any | null = null;
    private aabbY = 900;

    constructor(opts?: any) {
      if (opts?.type !== undefined) this.type = opts.type;
      if (opts?.userData) this.userData = opts.userData;
      // Make minY deterministic based on index when used in coverage calc
      if (this.type === b2BodyType.b2_dynamicBody && typeof this.userData.index === 'number') {
        // index 0 => 800, index 1 => 750, etc.
        this.aabbY = 800 - this.userData.index * 50;
      }
    }

    GetUserData() { return this.userData; }
    GetType() { return this.type; }
    GetMass() { return 1; }
    GetAngle() { return this.angle; }
    GetPosition() { return this.pos; }
    IsAwake() { return this.awake; }

    SetAwake(v: boolean) { this.awake = v; }
    SetAngle(v: number) { this.angle = v; }
    SetTransformXY(x: number, y: number, _angle: number) { this.pos = { x, y }; }
    ApplyTorque(_t: number) {}
    SetAngularVelocity(_v: number) {}
    SetLinearVelocity(_v: { x: number; y: number }) {}

    CreateFixture(_fd: any) {
      const fx = new FakeFixture(this, this.aabbY);
      this.fixtures.push(fx);
      if (!this.firstFixture) this.firstFixture = fx;
      return fx;
    }
    GetFixtureList() { return this.firstFixture; }
  }

  function b2LinearStiffness(_def: any, _hz: number, _ratio: number, _a: any, _b: any) {}

  class b2MouseJoint {}
  class b2MouseJointDef { bodyA: any; bodyB: any; target = { Copy: (_: any) => {} }; maxForce = 0; }

  function DrawJoints(_draw: any, _world: any) {}
  function DrawShapes(_draw: any, _world: any) {}

  class b2World {
    static Create(gravity: any) {
      const w = new b2World(gravity);
      createdWorlds.push(w);
      return w;
    }
    constructor(public gravity: any) {}
    SetAllowSleeping(_v: boolean) {}
    SetWarmStarting(_v: boolean) {}
    SetContinuousPhysics(_v: boolean) {}
    SetSubStepping(_v: boolean) {}
    ClearForces() {}

    CreateBody(opts?: any) {
      const b = new b2Body(opts);
      bodies.push(b);
      return b;
    }
    DestroyJoint(_j: any) { lastCreatedJoint = null; }
    CreateJoint(_def: any) {
      const joint = { SetTarget: vi.fn() };
      lastCreatedJoint = joint;
      return joint;
    }
    Step(_dt: number, _iters: any) {}
    QueryPointAABB(_p: any, cb: (f: any) => boolean) {
      // Feed first dynamic body's first fixture to the callback
      const fx = bodies.find(b => b.GetType() === b2BodyType.b2_dynamicBody)?.GetFixtureList();
      if (fx) cb(fx);
      return;
    }
  }

  return {
    b2Body,
    b2BodyType,
    b2EdgeShape,
    b2Fixture: class {},
    b2LinearStiffness,
    b2MouseJoint,
    b2MouseJointDef,
    b2PolygonShape,
    b2Vec2,
    b2World,
    DrawJoints,
    DrawShapes,
    __getLastJoint: () => lastCreatedJoint,
  };
});

// Must import after mocks
import Box2DSim from './Box2DSim';
import { __getLastJoint } from '@box2d/core';

function makeSvgWithTwoParts(): SVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');

  for (let i = 0; i < 2; i++) {
    const g = document.createElementNS(NS, 'g');

    const tool = document.createElementNS(NS, 'path');
    tool.setAttribute('d', 'M 0 0 L 5 0 L 5 5'); // a non-hitbox toolpath
    g.appendChild(tool);

    const hitboxes = document.createElementNS(NS, 'g');
    hitboxes.setAttribute('class', 'hitboxes');

    const path = document.createElementNS(NS, 'path');
    // Tokens parsed starting at index 4, stepping by 3
    path.setAttribute('d', 'M 0 0 L 10 0 L 10 10 L 0 10 L 0 0');
    hitboxes.appendChild(path);

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '10');
    rect.setAttribute('height', '10');
    // No rotation to avoid relying on rotateAroundOrigin
    g.appendChild(hitboxes);
    g.appendChild(rect);

    svg.appendChild(g);
  }
  return svg as unknown as SVGElement;
}

describe('Box2DSim', () => {
  afterEach(() => {
    cleanup();
    rafCalls = 0;
    vi.clearAllMocks();
  });

  it('reports pack height from the simulation loop', async () => {
    const svg = makeSvgWithTwoParts();
    const report = vi.fn();

    render(
      <Box2DSim
        svg={svg}
        seed={1}
        reportPackHeight={report}
        sheetWidth={384}
        sheetHeight={790}
      />
    );

    await waitFor(() => {
      // With mock AABBs: minY = 750 => 1000 - 750 = 250
      expect(report).toHaveBeenCalledWith(250);
    });
  });

  it('creates a mouse joint on drag and updates target on mouse move', async () => {
    const svg = makeSvgWithTwoParts();
    const { container } = render(
      <Box2DSim
        svg={svg}
        seed={1}
        reportPackHeight={() => {}}
        sheetWidth={384}
        sheetHeight={790}
      />
    );

    const canvas = container.querySelector('canvas')!;
    // mousedown (left button) should create a mouse joint
    fireEvent.mouseDown(canvas, { button: 0, offsetX: 500, offsetY: 500 });
    const joint = (__getLastJoint as () => any)();
    expect(joint).toBeTruthy();

    // mousemove should update joint target
    fireEvent.mouseMove(canvas, { offsetX: 520, offsetY: 525 });
    expect(joint.SetTarget).toHaveBeenCalledTimes(1);
  });

  it('downloads SVG on button click', async () => {
    const svg = makeSvgWithTwoParts();
    const createObjURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock');
    const revokeObjURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const origCreateEl = document.createElement.bind(document);
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = origCreateEl(tag) as any;
      if (tag === 'a') {
        el.click = clickSpy;
        // SaveSVG adds a 'click' listener; keep a no-op to avoid errors
        el.addEventListener = vi.fn();
      }
      return el;
    });

    const { getByRole } = render(
      <Box2DSim
        svg={svg}
        seed={1}
        reportPackHeight={() => {}}
        sheetWidth={384}
        sheetHeight={790}
      />
    );

    fireEvent.click(getByRole('button', { name: /download svg/i }));
    expect(createObjURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    // revoke happens via a timeout attached to the click handler; not asserted here
    expect(revokeObjURL).not.toHaveBeenCalled();
  });
});