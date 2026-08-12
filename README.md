# VehicleDes

VehicleDes is a browser-based 3D vehicle assembler for creators who need custom game-ready cars without learning a traditional modelling tool.

## Features

- Five responsive vehicle bodies: sports, sedan, SUV, truck, and van
- Smart attachment slots for wheels, lights, grilles, spoilers, bumpers, and windows
- Procedural real-time 3D preview with orbit, zoom, studio lighting, and shadows
- Per-part materials, body paint, glass tint, and gloss/satin/matte finishes
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
