# Physics Bin Packing

This is a tool to optimize polygonal part packing on a single 2d sheet using physics simulation.

The [bin packing problem](https://en.wikipedia.org/wiki/Packing_problems) is a class of optimization problems in mathematics known to be computationally difficult ([NP-Complete](https://en.wikipedia.org/wiki/NP-completeness)). There are commercial and open-source applications and CAD package plugins which seem to mostly use heuristic approximation algorithms. A physics engine seemed like it could be a fun alternative to experiment with. We're using a typescript port of the popular Box2D engine: [box2d.ts](https://github.com/lusito/box2d.ts).

## Setup

Install node `22.10.0`. In the project directory, run:

### `npm install` & `npm start`

This runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.

## Origin

This tool was developed as part of the workflow for a series of lazer-cut sculptures, but could probably be used for any 2d CNC process.

## Usage

- Initial part placement is random and deterministic based on a seed. By default it will automatically cycle through seeds recording those with the best packing density. There's not a huge about of variation in overall density, but it's fun to watch!
- Input is SVG (currently hardcoded).
- Parts are defined as top level group nodes.
- Actual part geometry does not need to be purely polygonal. It can include curves, interior details, text, etc.
-  A simplified shape must be provided for physics simulation. This is defined by a SVG group with class `hitboxes` that contains polygonal `<path>` or `rect` nodes.
- `hitbox` polygons should have 7 or fewer control points.
- More complex or concave shapes can be achieved by combining multiple convex nodes within the `hitboxes` group.
- `hitboxes` groups will be excluded from output. All other nodes and properties will be retained. Parts will be positioned on sheet with an added `transform` property, so input nodes should *not* include this property.

### Simplified Example:

Input:
```xml
<g fill="none" stroke="blue" stroke-width="0.3">
    <path d="M 26.48 -33.58 L 2.89 -86.60 Q 2.68 -87.08 2.17 -86.97 Q 1.67 -86.86 1.67 -86.35 L ..." />
    <g class="hitboxes">
        <path d="M 27.99 -30.79 L 1.42 -90.52 L 1.42 -2.55 L 27.99 -30.79" />
    </g>
</g>
```

Output:

```xml
<g fill="none" stroke="blue" stroke-width="0.3"
    transform="translate(409.72910872945386, 896.3707300965011) rotate(-89.99841816436704)">
    <path d="M 26.48 -33.58 L 2.89 -86.60 Q 2.68 -87.08 2.17 -86.97 Q 1.67 -86.86 1.67 -86.35 L ..." />
</g>
```
