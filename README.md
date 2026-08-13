# VehicleDes

VehicleDes is a browser-based 3D vehicle assembler for creators who need custom game-ready cars without learning a traditional modelling tool.

## Features

- Six responsive vehicle families: sports, muscle, sedan, SUV, truck, and van
- Nineteen selectable designs: three road generations per body plus a dedicated GT Competition generation for the sports family
- GT Competition detail inspired by modern endurance racers: full connected aero, wide track, pressure louvres, side intakes, roof scoop, race livery, windshield banner, roll cage, extinguisher, tire markings and optional swan-neck wing
- Progressive first-frame loading: usable geometry appears before reflections and post-processing stream in, with adaptive pixel density for slower devices
- Dedicated Vandal R/T muscle-car architecture with a long power-dome hood, shaker intake, squared shoulders, flared quarters, wide tires, twin stripes, and side pipes
- Smart attachment slots for wheels, lights, grilles, spoilers, bumpers, and windows
- Expanded 52-part library with centerlock race wheels, six-element lightblades, ram-air mesh, GT3 swan wing and competition aero package alongside the road, heritage and off-road catalog
- Muscle-focused library additions: deep-dish wheels, quad projectors, billet grille, street ducktail, and chrome bumpers
- Realistic body hardware including roof rails, shark-fin antennas, van sliding-door tracks, tow hitches, segmented lamps, third brake lights, parking sensors, recovery points, and drilled wheel hardware
- Twelve realistic metallic and solid paint presets
- AAA-style compound-curved bodies with tapered noses, rounded shoulders, separate crowned hood/deck panels, stamped character lines, arched roofs, mirrors, lighting, plates, exhausts, and underbody details
- Dedicated compound-curved front windshields, rear windscreens, inward-tapered side glass, structural A/B/C pillars, header rails, window sills, and panoramic roof panels
- High-detail wheels with individual tread blocks, drilled ventilated brake rotors, calipers, rim barrels, spokes, hubs, and lug nuts
- Game-ready cabin detail: stitched and bolstered seats, seat belts, dashboard, illuminated instrument and infotainment displays, vents, rear-view mirror, steering wheel, console, axles, and suspension
- Real-time preview with orbit, zoom, an HDR reflection studio, physically based clear-coat materials, ambient occlusion, selective bloom, SMAA, soft shadows, and a blurred reflective showroom floor
- Per-part materials, metallic body paint, glass tint, and gloss/satin/matte clear-coat finishes
- One-click part placement or “apply to all” for repeated slots
- Undo/redo, random concepts, autosave, and portable project JSON
- Client-side OBJ and binary GLB export
- Responsive parts library and material studio

## Development

```bash
npm install
npm run dev
```

The Vite development server runs on `http://localhost:5173` by default.

## Production build

```bash
npm run build
npm run preview
```

## Controls

- Drag in the viewport to orbit the camera
- Scroll to zoom
- Pick a library part, then click a glowing attachment slot
- `Ctrl/Cmd + Z` to undo and `Ctrl/Cmd + Shift + Z` to redo
- `Escape` to cancel placement; `Delete` to remove a selected part

All project data and generated model exports stay in the browser; no backend is required.
