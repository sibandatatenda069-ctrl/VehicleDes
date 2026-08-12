# VehicleDes

VehicleDes is a browser-based 3D vehicle assembler for creators who need custom game-ready cars without learning a traditional modelling tool.

## Features

- Five responsive vehicle bodies: sports, sedan, SUV, truck, and van
- Smart attachment slots for wheels, lights, grilles, spoilers, bumpers, and windows
- High-detail procedural 3D bodies with curved silhouettes, panoramic glass, mirrors, door seams, handles, lighting, plates, exhausts, and underbody details
- Realistic wheels with tread blocks, ventilated brake rotors, calipers, rim barrels, spokes, hubs, and lug nuts
- Real-time preview with orbit, zoom, a reflection studio, physically based materials, soft shadows, and an illuminated floor
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
