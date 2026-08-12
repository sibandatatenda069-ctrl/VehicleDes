import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Object3D } from 'three'
import {
  Box,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Expand,
  FileJson,
  Focus,
  Menu,
  MoreHorizontal,
  MousePointer2,
  Palette,
  Redo2,
  Rotate3D,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import {
  bodies,
  bodyById,
  categories,
  categorySlots,
  initialVehicle,
  paintSwatches,
  partById,
  parts,
  type BodyId,
  type CategoryId,
  type SlotId,
  type VehicleState,
} from './data'

const VehicleScene = lazy(() => import('./components/VehicleScene'))

type ToolId = 'body' | 'paint' | CategoryId

type Toast = { id: number; message: string; kind?: 'success' | 'neutral' }

const cloneVehicle = (value: VehicleState): VehicleState => JSON.parse(JSON.stringify(value))

function loadVehicle(): VehicleState {
  try {
    const saved = localStorage.getItem('vehicledes-project')
    if (saved) return { ...initialVehicle, ...JSON.parse(saved) }
  } catch {
    // Start with the bundled concept when storage is unavailable.
  }
  return initialVehicle
}

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vehicle'
}

function PartThumb({ category, id, accent }: { category: CategoryId; id: string; accent: string }) {
  if (category === 'wheels') {
    const spokes = id === 'wheel_classic' ? 5 : id === 'wheel_mesh' ? 10 : 7
    return (
      <div className="thumb-object wheel-thumb" style={{ '--part-accent': accent } as React.CSSProperties}>
        <div className="mini-wheel">
          {Array.from({ length: spokes }).map((_, i) => <i key={i} style={{ transform: `rotate(${(360 / spokes) * i}deg)` }} />)}
          <b />
        </div>
      </div>
    )
  }
  if (category === 'lights') return <div className={`thumb-object light-thumb ${id}`}><span /><span /></div>
  if (category === 'grilles') return <div className={`thumb-object grille-thumb ${id}`}>{Array.from({ length: 6 }).map((_, i) => <i key={i} />)}</div>
  if (category === 'spoilers') return <div className={`thumb-object spoiler-thumb ${id}`}><i /><i /><b /></div>
  if (category === 'bumpers') return <div className={`thumb-object bumper-thumb ${id}`}><i /><b /><i /></div>
  return <div className="thumb-object window-thumb" style={{ '--part-accent': accent } as React.CSSProperties}><i /><i /></div>
}

function BodyThumb({ id, color }: { id: BodyId; color: string }) {
  return (
    <div className={`body-thumb body-${id}`} style={{ '--body-color': color } as React.CSSProperties}>
      <div className="body-cabin" />
      <div className="body-base" />
      <i className="body-wheel one" />
      <i className="body-wheel two" />
    </div>
  )
}

function App() {
  const [vehicle, setVehicle] = useState<VehicleState>(loadVehicle)
  const [activeTool, setActiveTool] = useState<ToolId>('wheels')
  const [pendingPart, setPendingPart] = useState<string>()
  const [selectedSlot, setSelectedSlot] = useState<SlotId>()
  const [showSlots, setShowSlots] = useState(true)
  const [query, setQuery] = useState('')
  const [viewResetKey, setViewResetKey] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [saved, setSaved] = useState(true)
  const history = useRef<VehicleState[]>([])
  const future = useRef<VehicleState[]>([])
  const vehicleObject = useRef<Object3D | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const toastId = useRef(0)

  const activeCategory: CategoryId = activeTool === 'body' || activeTool === 'paint' ? 'wheels' : activeTool
  const visibleParts = useMemo(() => parts.filter((part) => part.category === activeCategory && part.name.toLowerCase().includes(query.toLowerCase())), [activeCategory, query])
  const selectedPart = partById(selectedSlot ? vehicle.parts[selectedSlot] : undefined)
  const body = bodyById(vehicle.bodyId)
  const partCount = Object.keys(vehicle.parts).length

  const notify = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = ++toastId.current
    setToasts((current) => [...current, { id, message, kind }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 2600)
  }, [])

  const updateVehicle = useCallback((updater: (current: VehicleState) => VehicleState) => {
    setVehicle((current) => {
      history.current.push(cloneVehicle(current))
      if (history.current.length > 40) history.current.shift()
      future.current = []
      setSaved(false)
      return updater(cloneVehicle(current))
    })
  }, [])

  const undo = useCallback(() => {
    const previous = history.current.pop()
    if (!previous) return
    setVehicle((current) => {
      future.current.push(cloneVehicle(current))
      return previous
    })
    setPendingPart(undefined)
    notify('Last change undone', 'neutral')
  }, [notify])

  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    setVehicle((current) => {
      history.current.push(cloneVehicle(current))
      return next
    })
    notify('Change restored', 'neutral')
  }, [notify])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem('vehicledes-project', JSON.stringify(vehicle))
      setSaved(true)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [vehicle])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const editing = event.target instanceof HTMLInputElement
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
      if (event.key === 'Escape') setPendingPart(undefined)
      if (!editing && (event.key === 'Backspace' || event.key === 'Delete') && selectedSlot) removeSelected()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  function chooseTool(tool: ToolId) {
    setActiveTool(tool)
    setQuery('')
    setPendingPart(undefined)
    setMobilePanelOpen(true)
  }

  function chooseBody(bodyId: BodyId) {
    updateVehicle((current) => ({ ...current, bodyId }))
    setSelectedSlot(undefined)
    notify(`${bodyById(bodyId).name} body selected`)
  }

  function choosePart(partId: string) {
    setPendingPart(partId)
    setSelectedSlot(undefined)
    setShowSlots(true)
  }

  function handleSlotClick(slot: SlotId) {
    if (pendingPart) {
      const definition = partById(pendingPart)
      if (definition && categorySlots[definition.category].includes(slot)) {
        updateVehicle((current) => ({ ...current, parts: { ...current.parts, [slot]: pendingPart } }))
        setSelectedSlot(slot)
        notify(`${definition.name} snapped into place`)
        if (categorySlots[definition.category].length === 1) setPendingPart(undefined)
        return
      }
    }
    setSelectedSlot(slot)
    const existing = partById(vehicle.parts[slot])
    if (existing) chooseTool(existing.category)
  }

  function applyToAll() {
    if (!pendingPart) return
    const definition = partById(pendingPart)
    if (!definition) return
    updateVehicle((current) => {
      const next = { ...current.parts }
      categorySlots[definition.category].forEach((slot) => { next[slot] = pendingPart })
      return { ...current, parts: next }
    })
    setSelectedSlot(categorySlots[definition.category][0])
    setPendingPart(undefined)
    notify(`${definition.name} applied to every compatible slot`)
  }

  function removeSelected() {
    if (!selectedSlot) return
    const name = partById(vehicle.parts[selectedSlot])?.name ?? 'Part'
    updateVehicle((current) => {
      const nextParts = { ...current.parts }
      const nextColors = { ...current.partColors }
      delete nextParts[selectedSlot]
      delete nextColors[selectedSlot]
      return { ...current, parts: nextParts, partColors: nextColors }
    })
    setSelectedSlot(undefined)
    notify(`${name} removed`, 'neutral')
  }

  function updateSelectedColor(color: string) {
    if (!selectedSlot) return
    updateVehicle((current) => ({ ...current, partColors: { ...current.partColors, [selectedSlot]: color } }))
  }

  function randomize() {
    const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
    updateVehicle((current) => {
      const nextParts: VehicleState['parts'] = {}
      categories.forEach((category) => {
        const candidates = parts.filter((part) => part.category === category.id)
        const selected = pick(candidates).id
        categorySlots[category.id].forEach((slot) => { nextParts[slot] = selected })
      })
      return { ...current, bodyId: pick(bodies).id, bodyColor: pick(paintSwatches), parts: nextParts }
    })
    setPendingPart(undefined)
    setSelectedSlot(undefined)
    notify('A fresh concept is ready')
  }

  function saveProject() {
    downloadBlob(JSON.stringify({ car: vehicle }, null, 2), `${slugify(vehicle.projectName)}.vehicledes.json`, 'application/json')
    notify('Project file downloaded')
  }

  function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const next = parsed.car ?? parsed
        updateVehicle(() => ({ ...initialVehicle, ...next }))
        notify('Project loaded')
      } catch {
        notify('That project file could not be read', 'neutral')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  async function exportModel(format: 'obj' | 'glb') {
    const object = vehicleObject.current
    if (!object) return
    setExportOpen(false)
    const name = slugify(vehicle.projectName)
    const exportObject = object.clone(true)
    const editorOnly: Object3D[] = []
    exportObject.traverse((child) => { if (child.userData.editorOnly) editorOnly.push(child) })
    editorOnly.forEach((child) => child.removeFromParent())
    try {
      if (format === 'obj') {
        const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js')
        const result = new OBJExporter().parse(exportObject)
        downloadBlob(result, `${name}.obj`, 'text/plain')
      } else {
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
        const exporter = new GLTFExporter()
        const result = await new Promise<ArrayBuffer>((resolve, reject) => {
          exporter.parse(exportObject, (data) => resolve(data as ArrayBuffer), reject, { binary: true, onlyVisible: true })
        })
        downloadBlob(result, `${name}.glb`, 'model/gltf-binary')
      }
      notify(`${format.toUpperCase()} exported — ready for your game`)
    } catch (error) {
      console.error(error)
      notify('Export failed. Please try again.', 'neutral')
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="icon-button menu-button" aria-label="Main menu"><Menu size={19} /></button>
        <div className="brand">
          <span className="brand-mark"><CarFront size={21} strokeWidth={2.2} /></span>
          <span>Vehicle<span>Des</span></span>
        </div>
        <div className="project-title-wrap">
          <span className="breadcrumb">Projects <b>/</b></span>
          <input
            aria-label="Project name"
            value={vehicle.projectName}
            onChange={(event) => updateVehicle((current) => ({ ...current, projectName: event.target.value }))}
          />
          <span className="draft-pill">CONCEPT</span>
        </div>
        <div className="save-state"><span className={saved ? 'saved-dot' : 'saving-dot'} />{saved ? 'Saved locally' : 'Saving…'}</div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Undo" disabled={!history.current.length} onClick={undo}><Undo2 size={18} /></button>
          <button className="icon-button" aria-label="Redo" disabled={!future.current.length} onClick={redo}><Redo2 size={18} /></button>
          <span className="top-divider" />
          <button className="secondary-button" onClick={saveProject}><FileJson size={16} /> Save</button>
          <div className="export-wrap">
            <button className="export-button" onClick={() => setExportOpen((open) => !open)}><Download size={16} /> Export <ChevronDown size={15} /></button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => exportModel('glb')}><span className="export-format">GLB</span><span><b>Game-ready GLB</b><small>Materials + geometry</small></span></button>
                <button onClick={() => exportModel('obj')}><span className="export-format">OBJ</span><span><b>Universal OBJ</b><small>Geometry for any 3D app</small></span></button>
                <div />
                <button onClick={saveProject}><FileJson size={18} /><span><b>VehicleDes project</b><small>Continue editing later</small></span></button>
              </div>
            )}
          </div>
          <button className="avatar-button" aria-label="Account">TD</button>
        </div>
      </header>

      <aside className="tool-rail" aria-label="Vehicle parts">
        <div className="rail-main">
          <button className={activeTool === 'body' ? 'active' : ''} onClick={() => chooseTool('body')} data-tooltip="Body"><Box size={21} /></button>
          <span className="rail-divider" />
          {categories.map(({ id, label, icon: Icon }) => (
            <button key={id} className={activeTool === id ? 'active' : ''} onClick={() => chooseTool(id)} data-tooltip={label}><Icon size={21} strokeWidth={1.8} /></button>
          ))}
          <span className="rail-divider" />
          <button className={activeTool === 'paint' ? 'active' : ''} onClick={() => chooseTool('paint')} data-tooltip="Paint & materials"><Palette size={21} /></button>
        </div>
        <div className="rail-bottom">
          <button onClick={randomize} data-tooltip="Surprise me"><Shuffle size={20} /></button>
          <button data-tooltip="Help"><CircleHelp size={20} /></button>
        </div>
      </aside>

      <section className="workspace">
        <Suspense fallback={<div className="studio-loading"><CarFront size={24} /><span>Opening 3D studio…</span></div>}>
          <VehicleScene
            vehicle={vehicle}
            activeCategory={activeCategory}
            pendingPart={pendingPart}
            selectedSlot={selectedSlot}
            showSlots={showSlots && Boolean(pendingPart)}
            viewResetKey={viewResetKey}
            onSlotClick={handleSlotClick}
            onVehicleReady={(object) => { vehicleObject.current = object }}
          />
        </Suspense>

        <div className="viewport-top-left">
          <div className="body-chip" onClick={() => chooseTool('body')}>
            <BodyThumb id={vehicle.bodyId} color={vehicle.bodyColor} />
            <span><small>{body.eyebrow} body</small><b>{body.name}</b></span>
            <ChevronDown size={16} />
          </div>
        </div>

        {pendingPart && (
          <div className="placement-banner">
            <span className="placement-icon"><MousePointer2 size={17} /></span>
            <span><b>Place {partById(pendingPart)?.name}</b><small>Click a glowing slot on the vehicle</small></span>
            {categorySlots[partById(pendingPart)?.category ?? activeCategory].length > 1 && <button onClick={applyToAll}><Zap size={14} /> Apply to all</button>}
            <button className="cancel-place" onClick={() => setPendingPart(undefined)} aria-label="Cancel placement"><X size={17} /></button>
          </div>
        )}

        <div className="viewport-bottom-left">
          <span className="live-dot" />
          <span><b>{partCount} parts</b> · {(38.4 + partCount * 1.24).toFixed(1)}k tris</span>
          <span className="viewport-divider" />
          <span>Y-up</span>
        </div>

        <div className="view-controls">
          <button onClick={() => setViewResetKey((key) => key + 1)} data-tooltip="Reset view"><Focus size={18} /></button>
          <button onClick={() => setShowSlots((visible) => !visible)} className={showSlots ? 'active' : ''} data-tooltip="Attachment slots"><Rotate3D size={18} /></button>
          <button onClick={toggleFullscreen} data-tooltip="Fullscreen"><Expand size={18} /></button>
        </div>

        <div className="orbit-hint"><MousePointer2 size={13} /><span>Drag to orbit</span><i />Scroll to zoom</div>
      </section>

      <aside className={`asset-panel ${mobilePanelOpen ? 'mobile-open' : ''}`}>
        <button className="mobile-close" onClick={() => setMobilePanelOpen(false)} aria-label="Close panel"><X size={18} /></button>
        {activeTool === 'body' ? (
          <BodyPanel vehicle={vehicle} onChoose={chooseBody} />
        ) : activeTool === 'paint' ? (
          <PaintPanel vehicle={vehicle} updateVehicle={updateVehicle} />
        ) : (
          <>
            <div className="panel-header">
              <div><span className="section-kicker">PARTS LIBRARY</span><h2>{categories.find((category) => category.id === activeCategory)?.label}</h2></div>
              <button className="icon-button"><MoreHorizontal size={19} /></button>
            </div>
            <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${activeCategory}…`} /><kbd>{visibleParts.length}</kbd></div>
            <div className="part-grid">
              {visibleParts.map((part) => {
                const isPending = pendingPart === part.id
                const installed = Object.values(vehicle.parts).filter((id) => id === part.id).length
                return (
                  <button key={part.id} className={`part-card ${isPending ? 'selected' : ''}`} onClick={() => choosePart(part.id)}>
                    <div className="part-preview"><PartThumb category={part.category} id={part.id} accent={part.accent} />{installed > 0 && <span className="installed-badge"><Check size={10} /> {installed}</span>}</div>
                    <span className="part-name">{part.name}</span>
                    <span className="part-meta">{part.meta}</span>
                  </button>
                )
              })}
            </div>
            <div className="library-foot"><Sparkles size={14} /> Showing compatible parts for <b>{body.name}</b></div>
          </>
        )}

        {selectedSlot && selectedPart && activeTool !== 'body' && activeTool !== 'paint' && (
          <div className="part-inspector">
            <div className="inspector-head"><span><small>SELECTED PART</small><b>{selectedPart.name}</b></span><button onClick={() => setSelectedSlot(undefined)}><X size={16} /></button></div>
            <label>Material color</label>
            <div className="mini-swatches">
              {['#171a18', '#aeb8b4', '#f0f2ed', '#b4f34b', '#d95645'].map((color) => (
                <button key={color} onClick={() => updateSelectedColor(color)} style={{ background: color }} className={(vehicle.partColors[selectedSlot] ?? vehicle.trimColor) === color ? 'active' : ''} aria-label={`Use ${color}`} />
              ))}
              <label className="custom-color"><input type="color" value={vehicle.partColors[selectedSlot] ?? vehicle.trimColor} onChange={(event) => updateSelectedColor(event.target.value)} /><Palette size={14} /></label>
            </div>
            <div className="inspector-actions"><button onClick={() => setPendingPart(selectedPart.id)}><MousePointer2 size={15} /> Move</button><button className="danger" onClick={removeSelected}><Trash2 size={15} /> Remove</button></div>
          </div>
        )}
      </aside>

      <button className="mobile-library-button" onClick={() => setMobilePanelOpen(true)}><Box size={17} /> Parts library</button>
      <input ref={fileInput} type="file" accept=".json,.vehicledes.json" hidden onChange={importProject} />
      <button className="hidden-import" onClick={() => fileInput.current?.click()}><Upload size={15} /> Import project</button>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => <div key={toast.id} className={`toast ${toast.kind ?? 'success'}`}><Check size={15} />{toast.message}</div>)}
      </div>
    </main>
  )
}

function BodyPanel({ vehicle, onChoose }: { vehicle: VehicleState; onChoose: (id: BodyId) => void }) {
  return (
    <>
      <div className="panel-header">
        <div><span className="section-kicker">STARTING POINT</span><h2>Choose a body</h2></div>
        <span className="panel-count">05</span>
      </div>
      <p className="panel-description">Pick a silhouette. Every body has smart attachment slots ready for your parts.</p>
      <div className="body-list">
        {bodies.map((body) => (
          <button key={body.id} className={`body-card ${vehicle.bodyId === body.id ? 'selected' : ''}`} onClick={() => onChoose(body.id)}>
            <BodyThumb id={body.id} color={vehicle.bodyId === body.id ? vehicle.bodyColor : '#b8beb8'} />
            <span><small>{body.eyebrow}</small><b>{body.name}</b></span>
            {vehicle.bodyId === body.id && <Check size={16} />}
          </button>
        ))}
      </div>
      <div className="tip-card"><span><Zap size={16} /></span><p><b>Smart slots included</b>Changing the body keeps compatible parts attached.</p></div>
    </>
  )
}

function PaintPanel({ vehicle, updateVehicle }: { vehicle: VehicleState; updateVehicle: (updater: (current: VehicleState) => VehicleState) => void }) {
  return (
    <>
      <div className="panel-header">
        <div><span className="section-kicker">MATERIAL STUDIO</span><h2>Paint & finish</h2></div>
        <Palette size={20} />
      </div>
      <div className="paint-section">
        <div className="paint-label"><span>BODY PAINT</span><b>{vehicle.bodyColor.toUpperCase()}</b></div>
        <div className="large-swatches">
          {paintSwatches.map((color) => <button key={color} style={{ background: color }} className={vehicle.bodyColor === color ? 'active' : ''} onClick={() => updateVehicle((current) => ({ ...current, bodyColor: color }))}>{vehicle.bodyColor === color && <Check size={14} />}</button>)}
          <label><input type="color" value={vehicle.bodyColor} onChange={(event) => updateVehicle((current) => ({ ...current, bodyColor: event.target.value }))} /><span>+</span></label>
        </div>
      </div>
      <div className="paint-section">
        <div className="paint-label"><span>FINISH</span></div>
        <div className="finish-selector">
          {(['gloss', 'satin', 'matte'] as const).map((finish) => <button key={finish} className={vehicle.finish === finish ? 'active' : ''} onClick={() => updateVehicle((current) => ({ ...current, finish }))}><i className={finish} />{finish}</button>)}
        </div>
      </div>
      <div className="paint-section">
        <div className="paint-label"><span>TRIM & DETAILS</span></div>
        <div className="material-row">
          <label><input type="color" value={vehicle.trimColor} onChange={(event) => updateVehicle((current) => ({ ...current, trimColor: event.target.value }))} /><i style={{ background: vehicle.trimColor }} /></label>
          <span><b>Exterior trim</b><small>Grilles, bumpers & accents</small></span>
          <code>{vehicle.trimColor}</code>
        </div>
        <div className="material-row">
          <label><input type="color" value={vehicle.glassColor} onChange={(event) => updateVehicle((current) => ({ ...current, glassColor: event.target.value }))} /><i style={{ background: vehicle.glassColor }} /></label>
          <span><b>Glass tint</b><small>Window material</small></span>
          <code>{vehicle.glassColor}</code>
        </div>
      </div>
    </>
  )
}

export default App
