
import { useEffect, useRef, useState } from "react";
import { renderToString } from 'react-dom/server';

import {
    b2Body,
    b2BodyType,
    b2EdgeShape,
    b2Fixture,
    b2FixtureDef,
    b2LinearStiffness,
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
SHEET_WIDTH /= ZOOM;
SHEET_HEIGHT /= ZOOM;

const WIDTH = 1000;
const HEIGHT = 1000;

interface IPartTransform { x: Number; y: Number; rotation: number }

function Box2DSim({ svg }: { svg: string }) {
    const debugCanvasRef = useRef<HTMLCanvasElement>(null);
    const m_debugDraw = useRef<DebugDraw>();
    const [paused, setPaused] = useState(false);
    const faceTransforms = useRef<IPartTransform[]>([])

    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

    let faceGroups: NodeListOf<Element> | undefined = undefined
    let faceGeoms: {
        polygonPoints: {
            x: number;
            y: number;
        }[]
    }[] = [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "application/xml");

    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
        console.log("error while parsing");
    }

    faceGroups = doc.documentElement.querySelectorAll("svg > g.face");
    faceGeoms = Array.from(faceGroups).map((faceGroup) => {
        const hitBoxPaths = faceGroup.querySelectorAll("g.hitboxes > path");
        const dParts = hitBoxPaths[0].getAttribute("d")?.split(" ") || [];
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
            polygonPoints.push({ x: +dParts[d], y: +dParts[d+1] }); // "L"
        }
        if (polygonPoints.length > 7) {
            console.warn("Warning! Hitzones with more than 7 control points will be truncated!")
        }

        return { polygonPoints };
    });

    // console.log(faceGeoms);


    const gravity: XY = { x: 0, y: 80 };
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
            // return
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
            density: 0.12,
            // friction: 0.0024, // nice with overlaps :-(
            friction: 0.0055,
        };
        const body = m_world.CreateBody({
            type: b2BodyType.b2_dynamicBody,
            position: { x: WIDTH / 2, y: (HEIGHT / 2 + 11 * (i + x)) / ZOOM },
            // userData: m_indices[i],
        });
        body.CreateFixture(fd);
        bodies.push(body);
    });

    const resetFaceGeomsPosition = () => {
        bodies.forEach((body, i) => {
            body.SetAwake(true);
            body.SetTransformXY(WIDTH / 2, (HEIGHT / 2 + 11 * (i + x)) / ZOOM, 0)
            body.SetAngularVelocity(0)
            body.SetLinearVelocity({ x: 0, y: 0 })
            console.log(body.GetTransform())
        });
    }


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
            // setMaxHeightOffset(Math.round(minY))
        }

        const m_ctx = debugCanvasRef.current?.getContext("2d");
        if (m_ctx) {
            m_ctx.clearRect(0, 0, m_ctx.canvas.width, m_ctx.canvas.height);
        }

        m_world.SetAllowSleeping(true);
        m_world.SetWarmStarting(true);
        m_world.SetContinuousPhysics(true);
        m_world.SetSubStepping(false); // TODO: experiment

        m_world.Step(1 / 60, {
            velocityIterations: 8,
            positionIterations: 9,
        });
        const draw = m_debugDraw.current;
        if (draw) {
            DrawShapes(draw, m_world);
            DrawJoints(draw, m_world);
            // DrawAABBs(draw, m_world);
        }
        // const SVG_RENDER = false; // SVG_RENDER && 
        if (bodies.some((body) => body.IsAwake())) {
            faceTransforms.current = bodies.map((body) => {
                const pos = body.GetPosition();
                const angle = body.GetAngle();
                return {
                    x: pos.x * ZOOM - 1500,
                    y: pos.y * ZOOM - 1500,

                    rotation: radiansToDegrees(angle),
                };
            })
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

    console.log("render Box2DSim");
    return (
        <div className="App">
            <canvas ref={debugCanvasRef} width="1000" height={1000} />
            <SVGOutput faceGroups={faceGroups} faceTransforms={faceTransforms.current} />
            <menu>
                <p>{faceGeoms.length} Parts</p>
                <p>Max Height: {maxHeightOffset}</p>
                <button onClick={() => {
                    console.log("Pause!")
                    setPaused(!paused)
                    bodies.forEach(body => {
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
                    resetFaceGeomsPosition()
                }}>Restart Simulation</button>
            </menu>
        </div>
    );
}

const SVGOutput = ({ faceGroups, faceTransforms }: { faceGroups?: NodeListOf<Element>, faceTransforms: IPartTransform[] }) => (
    <svg
        width={1000}
        height={1000}
        viewBox="0 0 1000 1000"
        xmlns="http://www.w3.org/2000/svg"
    >
        {Array.from(faceGroups || []).map((faceGroup, i) => {
            const transform = faceTransforms[i];

            const rects = Array.from(faceGroup.querySelectorAll("rect"));
            const gs = Array.from(faceGroup.querySelectorAll("g"));

            // Unify input paths with one Line or Arc per, into single part outline path
            const paths = faceGroup.querySelectorAll("path");
            // Grab first path's "M 12.34" command: (The only one we need!)
            let unifiedPathD = paths[0].getAttribute("d")?.split(" L ")[0] || "";
            paths.forEach(path => {
                // Accumulate the lines and arcs, assuming intermediate "M"oves are redundant. :u)
                const d = path.getAttribute("d") || "";
                let lineTo = d.includes(" L ") ? ` L ${d.split(" L ")[1]}` : "";
                let arcTo = d.includes(" A ") ? ` A ${d.split(" A ")[1]}` : "";
                unifiedPathD += lineTo + arcTo;
            })
            var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", unifiedPathD)
            const children = [path, ...rects, ...gs]

            return (
                <g

                    key={`face${i}`}
                    stroke="blue"
                    strokeWidth={0.3}
                    fill="none"
                    transform={`translate(${transform?.x || 20}, ${transform?.y || 80}) rotate(${transform?.rotation || 0})`}
                    dangerouslySetInnerHTML={{
                        __html: children.map(child => child.outerHTML).join(''), //faceGroup.innerHTML,
                    }}
                >

                </g>
            );
        })}
    </svg>
)

function radiansToDegrees(radians: number) {
    return radians * (180 / Math.PI);
}

const saveSVG = async (blob: Blob) => {
    const a = document.createElement('a');
    a.download = 'output.svg';
    a.href = URL.createObjectURL(blob);
    a.addEventListener('click', (e) => {
        setTimeout(() => URL.revokeObjectURL(a.href), 30 * 1000);
    });
    a.click();
};

export default Box2DSim;