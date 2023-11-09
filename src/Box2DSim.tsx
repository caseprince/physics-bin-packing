
import { useEffect, useRef, useState } from "react";
import { renderToString } from 'react-dom/server';

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


const ZOOM = 4;
let SHEET_WIDTH = 384;
let SHEET_HEIGHT = 790;
let PADDING = 20;
SHEET_WIDTH /= ZOOM;
SHEET_HEIGHT /= ZOOM;
PADDING /= ZOOM;

const WIDTH = 1000;
const HEIGHT = 1000;

interface IPartTransform { x: Number; y: Number; rotation: number }

function Box2DSim({ svg }: { svg: string }) {
    const debugCanvasRef = useRef<HTMLCanvasElement>(null);
    const m_debugDraw = useRef<DebugDraw>();
    // const [faceTransforms, setFaceTransforms] = useState<
    //   IPartTransform[]
    // >([]);
    const [paused, setPaused] = useState(false);
    const faceTransforms = useRef<IPartTransform[]>([])

    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom


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
            // setFaceTransforms(
            //   bodies.map((body) => {
            //     const pos = body.GetPosition();
            //     const angle = body.GetAngle();
            //     return {
            //       x: pos.x * ZOOM - 1500,
            //       y: pos.y * ZOOM - 1500,

            //       rotation: radiansToDegrees(angle),
            //     };
            //   })
            // );
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

    console.log("render App");
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