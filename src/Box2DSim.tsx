
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
    b2Shape,
    b2Vec2,
    b2World,
    DrawAABBs,
    DrawJoints,
    DrawShapes,
    XY,
} from "@box2d/core";
import { DebugDraw } from "@box2d/debug-draw";
import Stats from "stats.js";
import Prando from "prando";


const HUBSCALE = 1;
const SCALE_FACTOR = 4; // Controls scale of units in physics world. Box2D is optimized for a certain scale.
// Bigger is "smaller" and more performant than using mm units directly.
let SHEET_WIDTH = 384 / SCALE_FACTOR; // / 2;
let SHEET_HEIGHT = 790 / SCALE_FACTOR;

const WIDTH = 1000;
const HEIGHT = 1000;

interface IPartTransform { x: Number; y: Number; rotation: number }

function Box2DSim({ svg, seed }: { svg: SVGElement, seed: number }) {
    console.log("Box2DSim")
    const debugCanvasRef = useRef<HTMLCanvasElement>(null);
    const debugDrawRef = useRef<DebugDraw | null>(null);
    const statsRef = useRef<Stats | null>(null);

    const [paused, setPaused] = useState(false);
    const faceTransforms = useRef<IPartTransform[]>([])

    
    
    // Specific number seed
    const maxHeight = useRef(0); // Highest part's top edge (?) 
    const maxHeightBest = useRef(1000);

    let animationFrameLoop = useRef(0);
    useEffect(() => {
       

        const debugCanvas = debugCanvasRef.current;
        if (debugCanvas ) {         

            initSim();

            const m_ctx = debugCanvasRef.current?.getContext("2d");
            if (!m_ctx) throw new Error("Could not create 2d context for debug-draw");
            if (!debugDrawRef.current) {
                debugDrawRef.current = new DebugDraw(m_ctx);
                // draw.Prepare(500 / SCALE_FACTOR, 500 / SCALE_FACTOR, 1 / SCALE_FACTOR, false);
                
            }
            debugDrawRef.current.Prepare(WIDTH / 2, HEIGHT / 2, SCALE_FACTOR, false);
            
            if (!statsRef.current) {
                statsRef.current = new Stats();
                statsRef.current.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
                document.body.appendChild(statsRef.current.dom);
            }            

            debugCanvas.addEventListener("mousedown", (e) => handleMouseDown(e));
            debugCanvas.addEventListener("mouseup", (e) => handleMouseUp(e));
            debugCanvas.addEventListener("mousemove", (e) => handleMouseMove(e));

            
            animationFrameLoop.current = window.requestAnimationFrame(loop);
        }
        return () => {
            console.log("cleanup")
            debugDrawRef.current?.Finish();

            debugCanvas?.removeEventListener("mousedown", (e) => handleMouseDown(e));
            debugCanvas?.removeEventListener("mouseup", (e) => handleMouseUp(e));
            debugCanvas?.removeEventListener("mousemove", (e) => handleMouseMove(e));

            window.cancelAnimationFrame(animationFrameLoop.current);
        }
    });

    // let faceGroups: NodeListOf<Element> | undefined = undefined
    // let faceGeoms: {
    //     polygonPoints: {
    //         x: number;
    //         y: number;
    //     }[]
    // }[] = [];

    let bodies: b2Body[] =  [];// useRef<b2Body[]>([]);
    // useEffect(() => positionBodies, [seed])
    
    const positionBodies = () => {
        const rng = new Prando(seed);
        const cols = 6;
        console.log("positionBodies: "+seed)
        const bodiesToRandomSort = [...bodies]
        bodiesToRandomSort.sort((a, b) => a.GetUserData().index - b.GetUserData().index)
        bodiesToRandomSort.sort(() => rng.next(-1, 1))
        bodiesToRandomSort.forEach((body, i) => {
            body.SetTransformXY(WIDTH / 2 - 25 + ((i % cols) / cols) * 55, (HEIGHT * 2.4 - 22 * (Math.floor(i/cols) + 1)) * HUBSCALE / SCALE_FACTOR, 0)
            body.ApplyTorque(20)
            body.SetAngularVelocity(0)
            body.SetLinearVelocity({ x: 0, y: 0 })
            body.SetAwake(true);

            // if (i === 0) {
            //     //body.GetTransform().SetPosition(new transformWIDTH / 2, (HEIGHT / 2 + 11 * (i + x)) / SCALE_FACTOR)
            //     console.log(body.GetTransform().p.y)
            // }
        });
        // m_world.ClearForces();
        // m_world.Step(1 / 30, {
        //     velocityIterations: 8,
        //     positionIterations: 9,
        // });
    }

    let faceGroups: Element[] = [];
    let m_world: b2World;
    let ground: b2Body

    const initSim = () => {    
        console.log("initSim!");
        const gravity: XY = { x: 0, y: 9 };
        m_world = b2World.Create(gravity);
        // m_world.DestroyBody
        ground = m_world.CreateBody();
        
        const offSetX = SHEET_WIDTH / -2 + WIDTH / 2;
        const offSetY = SHEET_HEIGHT / -2 + HEIGHT / 2;
        const shape = new b2EdgeShape();

        console.log("offSetX", offSetX, offSetY)
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

        const smashBody = m_world.CreateBody();
        const smashShape = new b2PolygonShape();
        smashShape.SetAsBox(SHEET_WIDTH, 100, {x: WIDTH / 2, y: HEIGHT / 20})
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
        console.log("initSim faceGroup:" + faceGroups.length)
        faceGroups.forEach((faceGroup, i) => {
            if (i === 0 ) {
                console.log(JSON.stringify(faceGroup))
            }
            const body = m_world.CreateBody({
                type: b2BodyType.b2_dynamicBody,
                position: { x: 0, y: 0},
                userData: {index: i},
            });
            bodies.push(body);
            hitBoxPathSummedLengths.push(0)
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
                    console.warn("Warning! Hitzones with more than 7 control points will be truncated!")
                }

                for (let p = 0; p < polygonPoints.length; p++) {
                    const point1 = polygonPoints[p]
                    const point2 = polygonPoints[(p + 1) % polygonPoints.length]
                    const xDif = point1.x - point2.x;
                    const yDif = point1.y - point2.y;
                    hitBoxPathSummedLengths[i] += Math.sqrt(xDif * xDif + yDif * yDif)
                }

                const shape = new b2PolygonShape();
                // shape.SetAsBox(10 / SCALE_FACTOR, 10 / SCALE_FACTOR);
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
            })

            // HITBOX RECTS
            const hitBoxRects = faceGroup.querySelectorAll("g.hitboxes > rect");
            // console.log(hitBoxRects)
            hitBoxRects.forEach(rect => {
                const x = +(rect.getAttribute("x") as string) / SCALE_FACTOR * HUBSCALE
                const y = +(rect.getAttribute("y") as string) / SCALE_FACTOR * HUBSCALE
                let width = +(rect.getAttribute("width") as string) / SCALE_FACTOR * HUBSCALE
                let height = +(rect.getAttribute("height") as string) / SCALE_FACTOR * HUBSCALE
                const transform = rect.getAttribute("transform");
                let rotation = 0;
                if (transform) {
                    console.log(transform, transform.split("rotate("))
                    rotation = +(transform.split("rotate(")[1].slice(0, -1)) // this is gross but regex is hard
                }
                // console.log(x, y, width, height, rotation)
                let center = { x: x + width / 2, y: y + height / 2 };
                if (rotation) {
                    center = rotateAroundOrigin(center.x, center.y, degreesToRadians(-rotation))
                }
                const shape = new b2PolygonShape();
                shape.SetAsBox(width / 2, height / 2, center, degreesToRadians(rotation))

                const fd: b2FixtureDef = {
                    shape,
                    density: 0.12,
                    friction: 0.0055,
                };

                body.CreateFixture(fd);
            })
        });

        positionBodies();
    }

    const resetFaceGeomsPosition = () => {  
        positionBodies();
    }
    



    // useEffect(() => {
    //     const interval = setInterval(() => {
    //         bumpSeed()
    //     }, 30000)
    //     return () => clearInterval(interval)
    // }, [])
    

    // LOOP
    const loop = () => {
        statsRef.current?.begin();
        const m_ctx = debugCanvasRef.current?.getContext("2d");
        if (m_ctx) {
            m_ctx.clearRect(0, 0, m_ctx.canvas.width, m_ctx.canvas.height);
        }

        m_world.SetAllowSleeping(true);
        m_world.SetWarmStarting(true);
        m_world.SetContinuousPhysics(true);
        m_world.SetSubStepping(false); // TODO: experiment

        m_world.Step(1 / 30, {
            velocityIterations: 8,
            positionIterations: 9,
        });
        const draw = debugDrawRef.current;
        if (draw) {
            DrawShapes(draw, m_world);
            DrawJoints(draw, m_world);
            DrawAABBs(draw, m_world);
        }

        let maxY = 0
        let minY = 1000
        bodies.forEach((body, i) => {
            const fix = body.GetFixtureList()
            const lowerY = fix?.GetAABB(0).lowerBound.y || 0
            if (lowerY < minY) {
                minY = lowerY;
            }

            const upperY = 1000 - 16 - (fix?.GetAABB(0).lowerBound.y || 0)
            if (upperY && maxY < upperY) {
                maxY = upperY
                
            }
            // if (i === 53) {
            //     console.log(lowerY, fix?.GetAABB(0).lowerBound.y)
            // }
        })
        // console.log(minY, bodies[53].GetFixtureList()?.GetAABB(0).lowerBound.y)

        maxHeight.current = 1000 - 16 - minY; // Math.round(minY)

        // const SVG_RENDER = false; // SVG_RENDER && 
        if (bodies.some((body) => body.IsAwake())) {
            faceTransforms.current = bodies.map((body) => {
                const pos = body.GetPosition();
                const angle = body.GetAngle();
                return {
                    x: pos.x * SCALE_FACTOR - 1500,
                    y: pos.y * SCALE_FACTOR - 1500,

                    rotation: radiansToDegrees(angle),
                };
            })
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
                        console.log(body.GetUserData())
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
        return new b2Vec2(WIDTH / 2 + xDiff / SCALE_FACTOR, HEIGHT / 2 + yDiff / SCALE_FACTOR);
    };
    const handleMouseUp = (e: MouseEvent): void => {
        if (m_mouseJoint) {
            m_world.DestroyJoint(m_mouseJoint);
            m_mouseJoint = null;
        }
    };

    console.log(faceGroups)
    return (
        <div className="App">
            <canvas ref={debugCanvasRef} width="1000" height={1000} />
            <SVGOutput faceGroups={faceGroups} faceTransforms={faceTransforms.current} />


            <menu>
                <p>.</p>
                <p>.</p>   
                <p>.</p>
                <p>.</p> 
                <p>.</p>
                <p>.</p> 
                <p>.</p>
                <p>.</p>              
                <p>Max Height: {maxHeight.current}</p>
                <button onClick={() => {
                    console.log("Pause!")
                    setPaused(!paused)
                    bodies.forEach(body => {
                        // console.log(body.IsAwake()) // This seems to contradict the pink/grey debg UI state?
                        body.SetAwake(false);
                        // console.log(body.IsAwake())
                        const draw = debugDrawRef.current;
                        if (draw) {
                            DrawShapes(draw, m_world);
                        }

                    })
                }}>{paused ? "Resume Simulation" : "Pause Simulation"}</button>
                <br />
                <button onClick={() => {
                    const svgString = renderToString(<SVGOutput faceGroups={faceGroups} faceTransforms={faceTransforms.current} />);
                    const blob = new Blob([svgString], { type: 'application/json' });
                    saveSVG(blob)
                }}>Download SVG</button>
                <br />
                <button onClick={() => {
                    console.log("restart")
                    resetFaceGeomsPosition()
                }}>Restart Simulation</button>
                
            </menu>
        </div>
    );
}

const SVGOutput = ({ faceGroups, faceTransforms }: { faceGroups?: Array<Element>, faceTransforms: IPartTransform[] }) => (
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
            const toolpaths = Array.from(faceGroup.children).filter(child => {
                // console.log(child.className)
                // console.log(child.classList)
                return !Array.from(child.classList).includes("hitboxes")
            })

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
            const dataLabels = Array.from(textElements).map(element => `~${element.textContent}~`).join(",")
            return (
                <g
                    key={`face${i}`}
                    data-labels={dataLabels}
                    stroke="blue"
                    strokeWidth={0.3}
                    fill="none"
                    transform={`translate(${transform?.x || 20}, ${transform?.y || 80}) rotate(${transform?.rotation || 0})`}
                    dangerouslySetInnerHTML={{
                        __html: toolpaths.map(child => child.outerHTML).join(''),
                        //__html: faceGroup.innerHTML,
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
function degreesToRadians(degrees: number) {
    return degrees * (Math.PI / 180);
}

function rotateAroundOrigin(x: number, y: number, radians: number) {
    // """Only rotate a point around the origin (0, 0)."""
    const xx = x * Math.cos(radians) + y * Math.sin(radians)
    const yy = -x * Math.sin(radians) + y * Math.cos(radians)

    return { x: xx, y: yy }
}

const saveSVG = async (blob: Blob) => {
    const a = document.createElement('a');
    a.download = 'output.svg'; // TODO: Match input SVG name
    a.href = URL.createObjectURL(blob);
    a.addEventListener('click', (e) => {
        setTimeout(() => URL.revokeObjectURL(a.href), 30 * 1000);
    });
    a.click();
};

export default Box2DSim;