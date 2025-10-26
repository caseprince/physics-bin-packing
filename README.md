# Physics Bin Packing

This tool packs polygonal parts on a single 2D sheet using a physics‑based approach.

The [bin‑packing problem](https://en.wikipedia.org/wiki/Packing_problems) is NP‑complete. Most commercial and open‑source tools (including CAD plugins) rely on heuristics. Here, we explore a different angle: driving the layout with a physics engine. The simulation runs on Box2D for the web: [@box2d/core](https://www.npmjs.com/package/@box2d/core).

<!-- markdownlint-disable-next-line MD033 -->
[<img src="images/screenshot.png" alt="Screenshot of physics simulation" width="500">](https://caseprince.github.io/physics-bin-packing/)\
*View project live at [https://caseprince.github.io/physics-bin-packing/](https://caseprince.github.io/physics-bin-packing/).*

## Setup

Requirements: Node.js 22.20.0 (or a current LTS). In the project directory, run:

### `npm install` && `npm run dev`

This starts the Vite dev server.
Open the URL printed in the terminal.

## Usage

- Initial placement is random but seed‑driven (deterministic). The app can auto‑cycle seeds and record those with the best (lowest) pack height. Variation between seeds is modest—but it's fun to watch.
- Input is an SVG (currently hardcoded).
- Parts are defined as top‑level `<g>` nodes.
- Part geometry doesn't need to be purely polygonal; curves, interior details, and text are fine.
- Provide a simplified collision shape for the simulation: an SVG group with class `hitboxes` containing polygonal `<path>` or `<rect>` elements.
- Hitbox polygons work best with seven points or fewer.
- Model concave or intricate shapes by combining multiple convex nodes within `hitboxes`.
- `hitboxes` groups are excluded from the output; all other nodes and attributes are preserved. Parts are positioned on the sheet via a `transform` attribute, so input nodes should not already set `transform`.

### Example SVG Part Geometry

![Example SVG Part Geometry](images/hub-example.svg?raw=true "Example SVG Part Geometry")
*Tool paths are shown in blue and green. Physics `hitboxes` are shown in red.*

### Simplified Example of Input & Output

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

## Origin

Originally built for a series of laser‑cut sculptures, but it's suitable for any 2D CNC workflow.

![Wireframe alongside laser-cut acrylic cat sculpture](images/laser-cat.jpg?raw=true "Wireframe alongside laser-cut acrylic cat sculpture")
