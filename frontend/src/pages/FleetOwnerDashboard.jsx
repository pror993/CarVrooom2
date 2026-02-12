import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { pipelineAPI } from '../services/api'
import { usePipelineSocket } from '../services/usePipelineSocket'
import {
  HiLogout, HiTruck, HiExclamation, HiCheck,
  HiPlay, HiStop, HiRefresh, HiClock,
  HiLightningBolt, HiShieldCheck, HiExclamationCircle, HiUser,
  HiHome, HiClipboardList, HiBell, HiCog, HiSearch,
  HiChevronDown, HiChevronRight, HiDotsHorizontal,
  HiLocationMarker, HiX, HiFire, HiBeaker,
  HiStatusOnline, HiDatabase, HiChartPie,
} from 'react-icons/hi'

/* ── Intersection-point grid background (canvas) ───────────────── */
function DotGridCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, time = 0

    const gridSize = 44
    let cols, rows, dots = []

    const resize = () => {
      canvas.width = canvas.parentElement.clientWidth
      canvas.height = canvas.parentElement.clientHeight
      cols = Math.ceil(canvas.width / gridSize) + 1
      rows = Math.ceil(canvas.height / gridSize) + 1
    }

    const spawnDot = (init = false) => {
      const col = Math.floor(Math.random() * cols)
      const row = Math.floor(Math.random() * rows)
      const hue = Math.random() < 0.7 ? 270 : (Math.random() < 0.5 ? 250 : 290)
      dots.push({
        x: col * gridSize, y: row * gridSize,
        life: init ? Math.random() : 0,
        maxA: Math.random() * 0.55 + 0.15,
        speed: Math.random() * 0.006 + 0.002,
        radius: Math.random() * 1.4 + 1,
        hue,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 0.5
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath(); ctx.moveTo(c * gridSize, 0); ctx.lineTo(c * gridSize, canvas.height); ctx.stroke()
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * gridSize); ctx.lineTo(canvas.width, r * gridSize); ctx.stroke()
      }

      // static intersection dots
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          ctx.beginPath()
          ctx.arc(c * gridSize, r * gridSize, 0.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // glowing dots
      dots = dots.filter(d => {
        d.life += d.speed
        if (d.life >= 1) return false
        const t = d.life < 0.5 ? d.life / 0.5 : (1 - d.life) / 0.5
        const a = t * d.maxA

        // outer glow
        const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, 12)
        grad.addColorStop(0, `hsla(${d.hue},80%,70%,${a * 0.35})`)
        grad.addColorStop(1, `hsla(${d.hue},80%,70%,0)`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(d.x, d.y, 12, 0, Math.PI * 2); ctx.fill()

        // core dot
        ctx.fillStyle = `hsla(${d.hue},80%,75%,${a})`
        ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2); ctx.fill()
        return true
      })
    }

    const loop = () => {
      time++
      if (time % 12 === 0) {
        const n = Math.floor(Math.random() * 3) + 1
        for (let i = 0; i < n; i++) spawnDot()
      }
      draw()
      raf = requestAnimationFrame(loop)
    }

    resize()
    for (let i = 0; i < Math.floor(cols * rows * 0.04); i++) spawnDot(true)
    loop()

    const onResize = () => { resize(); dots = []; for (let i = 0; i < Math.floor(cols * rows * 0.04); i++) spawnDot(true) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf) }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}

/* ── Vehicle display-name map ──────────────────────────────────── */
const VEHICLE_NAMES = {
  VH_HEALTHY:  'Tata Prima 4928.S',
  VH_DPF_FAIL: 'Tata Prima 4928.S II',
  VH_SCR_FAIL: 'Tata Signa 4825.TK',
  VH_OIL_FAIL: 'Tata Prima 4028.S',
  VH_ANOMALY:  'Ashok Leyland Captain',
  VH_CASCADE:  'Tata Prima 5530.S',
}
function getVehicleName(v) {
  return VEHICLE_NAMES[v.vehicleId] ||
    `${v.vehicleInfo?.make || ''} ${v.vehicleInfo?.model || ''}`.trim() ||
    v.vehicleId
}

/* ── Severity pill ─────────────────────────────────────────────── */
function SeverityBadge({ level }) {
  const c = {
    critical: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/5',
    high:     'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-orange-500/5',
    medium:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-yellow-500/5',
    low:      'bg-green-500/10 text-green-400 border-green-500/20 shadow-green-500/5',
  }[level] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-sm capitalize ${c}`}>{level}</span>
}

/* ── Failure-type badge (icons, no emoji) ──────────────────────── */
function FailureTypeBadge({ predictionType }) {
  if (!predictionType || predictionType === 'healthy') return null
  const map = {
    dpf_failure:       { Icon: HiFire,              c: 'text-orange-400', l: 'DPF Failure' },
    scr_failure:       { Icon: HiBeaker,            c: 'text-blue-400',   l: 'SCR Failure' },
    oil_failure:       { Icon: HiDatabase,          c: 'text-amber-400',  l: 'Oil Failure' },
    cascade_failure:   { Icon: HiLightningBolt,     c: 'text-red-400',    l: 'Cascade' },
    anomaly:           { Icon: HiStatusOnline,      c: 'text-purple-400', l: 'Anomaly' },
    anomaly_detection: { Icon: HiStatusOnline,      c: 'text-purple-400', l: 'Anomaly' },
    single_failure:    { Icon: HiExclamation,       c: 'text-yellow-400', l: 'Failure' },
  }
  const f = map[predictionType] || { Icon: HiCog, c: 'text-gray-400', l: predictionType?.replace('_', ' ') }
  const { Icon } = f
  return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${f.c}`}><Icon className="w-3 h-3" />{f.l}</span>
}

/* ── SVG donut ─────────────────────────────────────────────────── */
function HealthDonut({ critical, medium, low }) {
  const total = critical + medium + low || 1
  const cPct = Math.round((critical / total) * 100)
  const mPct = Math.round((medium / total) * 100)
  const lPct = Math.round((low / total) * 100)
  // Show healthy % in center as the fleet health score
  const healthScore = lPct

  const r = 38, C = 2 * Math.PI * r
  // Each arc: dasharray = [arcLen, gap]; dashoffset shifts the start position
  const arcL = (lPct / 100) * C   // green (healthy)
  const arcM = (mPct / 100) * C   // yellow (warning)
  const arcC = (cPct / 100) * C   // purple (critical)
  // SVG dashoffset rotates clockwise when negative. Start green at 0, warning after green, critical after green+warning.
  const offL = 0
  const offM = -(arcL)
  const offC = -(arcL + arcM)

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
        {arcL > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="#22c55e" strokeWidth="8"
          strokeDasharray={`${arcL} ${C - arcL}`} strokeDashoffset={offL} strokeLinecap="round" className="drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]" />}
        {arcM > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="#eab308" strokeWidth="8"
          strokeDasharray={`${arcM} ${C - arcM}`} strokeDashoffset={offM} strokeLinecap="round" className="drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]" />}
        {arcC > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="#a855f7" strokeWidth="8"
          strokeDasharray={`${arcC} ${C - arcC}`} strokeDashoffset={offC} strokeLinecap="round" className="drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" />}
      </svg>
      <div className="absolute text-center">
        <span className="text-2xl font-bold text-white">{healthScore}<span className="text-sm text-gray-500">%</span></span>
      </div>
    </div>
  )
}

/* ── Glass card wrapper ────────────────────────────────────────── */
function Card({ children, className = '', glow = false }) {
  return (
    <div className={`rounded-2xl border border-purple-500/10 bg-purple-950/12 backdrop-blur-md ${glow ? 'shadow-[0_0_40px_-10px_rgba(168,85,247,0.2)]' : 'shadow-[0_0_20px_-8px_rgba(168,85,247,0.08)]'} ${className}`}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN DASHBOARD                                                */
/* ═══════════════════════════════════════════════════════════════ */
export default function FleetOwnerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { connected, alerts: wsAlerts, tickInfo } = usePipelineSocket()

  const [vehicles, setVehicles]             = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [schedulerStatus, setSchedulerStatus] = useState(null)
  const [cases, setCases]                   = useState([])
  const [loading, setLoading]               = useState(true)
  const [actionLoading, setActionLoading]   = useState(false)
  const [activeNav, setActiveNav]           = useState('dashboard')
  const [showPanel, setShowPanel]           = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [vRes, sRes, cRes] = await Promise.all([
        pipelineAPI.getVehicles(), pipelineAPI.getStatus(), pipelineAPI.getCases('active'),
      ])
      if (vRes.success) setVehicles(vRes.data)
      if (sRes.success) setSchedulerStatus(sRes.data)
      if (cRes.success) setCases(cRes.data)
    } catch (e) { console.error('Fetch error:', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 15000); return () => clearInterval(i) }, [fetchData])
  useEffect(() => { if (tickInfo) fetchData() }, [tickInfo, fetchData])

  const START_DAY = 43
  const handleStart = async () => { setActionLoading(true); await pipelineAPI.start(START_DAY); await fetchData(); setActionLoading(false) }
  const handleStop  = async () => { setActionLoading(true); await pipelineAPI.stop(); await fetchData(); setActionLoading(false) }
  const handleReset = async () => {
    if (!confirm('Reset scheduler and clear all prediction/case data?')) return
    setActionLoading(true); await pipelineAPI.reset(true); await fetchData(); setActionLoading(false)
  }
  const handleLogout = async () => { await logout(); navigate('/') }

  const healthyCount  = vehicles.filter(v => v.healthStatus === 'healthy').length
  const warningCount  = vehicles.filter(v => v.healthStatus === 'warning').length
  const criticalCount = vehicles.filter(v => v.healthStatus === 'critical').length
  const pendingMaint  = warningCount + criticalCount
  const selectedData  = selectedVehicle ? vehicles.find(v => v.vehicleId === selectedVehicle) : null
  const userName = user?.profile?.name || user?.email?.split('@')[0] || 'Fleet Owner'

  const allAlerts = useMemo(() => {
    const combined = [...wsAlerts]
    cases.forEach(c => { if (!combined.find(a => a.caseId === c.caseId)) combined.push({ ...c, predictionType: c.metadata?.predictionType }) })
    return combined.slice(0, 20)
  }, [wsAlerts, cases])

  if (loading) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-4" />
        <p className="text-sm text-gray-500">Loading fleet data</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white flex relative overflow-hidden">
      {/* Grid canvas background */}
      <div className="fixed inset-0 z-0"><DotGridCanvas /></div>

      {/* ═════════ SIDEBAR ═════════ */}
      <aside className="w-52 bg-purple-950/20 border-r border-purple-500/10 flex flex-col fixed h-screen z-30 backdrop-blur-lg shadow-[4px_0_30px_-10px_rgba(168,85,247,0.1)]">
        <div className="px-5 py-5 border-b border-purple-500/10 cursor-pointer" onClick={() => navigate('/')}>
          <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">AfterCare AI</h1>
        </div>
        <div className="px-5 py-2.5 border-b border-purple-500/10">
          <span className="text-[10px] font-medium text-purple-400/70 uppercase tracking-widest">Fleet Owner</span>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {[
            { id:'dashboard',     label:'Dashboard',         icon:HiHome },
            { id:'fleet',         label:'Fleet',             icon:HiTruck },
            { id:'cases',         label:'Maintenance Cases', icon:HiClipboardList },
            { id:'notifications', label:'Notifications',     icon:HiBell, badge:allAlerts.length||null },
            { id:'account',       label:'Account',           icon:HiUser },
          ].map(n => {
            const Icon = n.icon, act = activeNav === n.id
            return (
              <button key={n.id} onClick={() => setActiveNav(n.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${act ? 'bg-purple-500/10 text-purple-300 shadow-[0_0_15px_-5px_rgba(168,85,247,0.2)]' : 'text-gray-500 hover:text-gray-300 hover:bg-purple-950/20'}`}>
                <Icon className={`text-base flex-shrink-0 ${act ? 'text-purple-400' : ''}`} />
                <span className="truncate">{n.label}</span>
                {n.badge && <span className="ml-auto bg-purple-500/20 text-purple-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{n.badge}</span>}
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-purple-500/10">
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:text-gray-300 hover:bg-purple-950/20 transition-all">
            <HiLogout className="text-base" /> Logout
          </button>
        </div>
      </aside>

      {/* ═════════ MAIN ═════════ */}
      <main className="flex-1 ml-52 relative z-10">
        {/* top bar */}
        <header className="sticky top-0 z-20 bg-purple-950/15 backdrop-blur-xl border-b border-purple-500/10 shadow-[0_4px_30px_-10px_rgba(168,85,247,0.08)]">
          <div className="px-7 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.6)]' : 'bg-red-500'}`} />
                <span className="text-gray-500">{connected ? 'Live' : 'Offline'}</span>
              </div>
              {schedulerStatus && (
                <div className="flex items-center gap-3 text-[11px] text-gray-600">
                  <span className={schedulerStatus.isRunning ? 'text-purple-400' : ''}>{schedulerStatus.isRunning ? 'Running' : 'Stopped'}</span>
                  <span>Day {schedulerStatus.simDay || 0}/60</span>
                  <span>Tick #{schedulerStatus.tickCount || 0}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <HiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
                <input type="text" placeholder="Search..." className="pl-8 pr-3 py-1.5 bg-purple-950/15 border border-purple-500/10 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/30 focus:shadow-[0_0_12px_-4px_rgba(168,85,247,0.3)] w-40 transition-all" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/80 to-purple-700/80 flex items-center justify-center text-[10px] font-bold shadow-[0_0_10px_-3px_rgba(168,85,247,0.4)]">{userName.charAt(0).toUpperCase()}</div>
                <span className="text-xs text-gray-400">{userName}</span>
                <HiChevronDown className="text-gray-600 text-[10px]" />
              </div>
            </div>
          </div>
        </header>

        <div className="px-7 py-5">
          {/* welcome + controls */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold">Welcome back, <span className="bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">{userName}</span></h2>
            <div className="flex items-center gap-2">
              {!schedulerStatus?.isRunning ? (
                <button onClick={handleStart} disabled={actionLoading} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600/80 hover:bg-purple-500/80 disabled:opacity-40 rounded-lg text-[11px] font-semibold transition-all shadow-[0_0_15px_-5px_rgba(168,85,247,0.4)] hover:shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]"><HiPlay className="text-xs" /> Start Pipeline</button>
              ) : (
                <button onClick={handleStop} disabled={actionLoading} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600/60 hover:bg-red-500/60 disabled:opacity-40 rounded-lg text-[11px] font-semibold transition-colors"><HiStop className="text-xs" /> Stop</button>
              )}
              <button onClick={handleReset} disabled={actionLoading || schedulerStatus?.isRunning} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/15 hover:bg-purple-900/20 border border-purple-500/10 disabled:opacity-30 rounded-lg text-[11px] font-medium transition-colors"><HiRefresh className="text-xs" /> Reset</button>
            </div>
          </div>

          {schedulerStatus?.isRunning && (
            <div className="mb-5"><div className="w-full bg-purple-950/20 rounded-full h-1">
              <div className="bg-gradient-to-r from-purple-600 to-purple-400 h-1 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                style={{ width: `${((schedulerStatus.currentRowIndex||0)/(schedulerStatus.maxRows||17280))*100}%` }} />
            </div></div>
          )}

          {/* ── stat cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {[
              { label:'Total Vehicles', value:vehicles.length, Icon:HiTruck,              glow:'purple' },
              { label:'Pending Maintenance', value:pendingMaint, Icon:HiCog,              glow:'yellow' },
              { label:'Total Alerts',   value:allAlerts.length, Icon:HiExclamationCircle, glow:'red'    },
            ].map((s,i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.glow==='purple'?'bg-purple-500/10':'bg-purple-950/20'}`}>
                    <s.Icon className={`text-lg ${s.glow==='purple'?'text-purple-400':s.glow==='yellow'?'text-yellow-400':'text-red-400'}`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{s.label}</p>
                    <p className="text-2xl font-bold mt-0.5">{s.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* ── fleet overview + health donut ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <Card className="lg:col-span-2 overflow-hidden" glow>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold">Fleet Overview</h3>
                <HiDotsHorizontal className="text-gray-600 cursor-pointer hover:text-gray-400 text-xs" />
              </div>
              <div className="relative h-56 mx-4 mb-3 rounded-xl overflow-hidden border border-purple-500/10"
                style={{ background: 'radial-gradient(ellipse at 45% 40%, #1a1333 0%, #0f0d1a 50%, #0a0a12 100%)' }}>

                {/* Topo contour lines */}
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  {/* Region boundary — Haryana blob */}
                  <path d="M80,30 Q120,25 180,40 Q240,50 300,55 Q340,70 350,100 Q355,135 330,155 Q290,175 240,170 Q190,168 150,155 Q110,140 90,120 Q65,95 60,70 Q55,48 80,30Z"
                    fill="rgba(168,85,247,0.04)" stroke="rgba(168,85,247,0.12)" strokeWidth="1" strokeDasharray="3 2" />
                  {/* Region boundary — Delhi NCR blob */}
                  <path d="M320,40 Q370,30 420,38 Q460,50 480,75 Q490,110 470,130 Q440,150 400,148 Q360,145 340,125 Q310,100 305,70 Q300,50 320,40Z"
                    fill="rgba(139,92,246,0.05)" stroke="rgba(139,92,246,0.15)" strokeWidth="1" strokeDasharray="3 2" />

                  {/* Topo contour rings */}
                  <ellipse cx="200" cy="100" rx="130" ry="70" fill="none" stroke="rgba(168,85,247,0.06)" strokeWidth="0.7" />
                  <ellipse cx="200" cy="100" rx="100" ry="50" fill="none" stroke="rgba(168,85,247,0.05)" strokeWidth="0.5" />
                  <ellipse cx="200" cy="100" rx="65"  ry="32" fill="none" stroke="rgba(168,85,247,0.04)" strokeWidth="0.5" />
                  <ellipse cx="420" cy="85"  rx="60"  ry="40" fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth="0.7" />
                  <ellipse cx="420" cy="85"  rx="38"  ry="22" fill="none" stroke="rgba(139,92,246,0.04)" strokeWidth="0.5" />

                  {/* Highway network */}
                  <path d="M60,90 Q150,75 250,80 Q350,85 500,70" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                  <path d="M60,90 Q150,75 250,80 Q350,85 500,70" fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="1" strokeDasharray="8 4" />
                  <text x="135" y="72" fill="rgba(168,85,247,0.25)" fontSize="7" fontFamily="monospace">NH-48</text>

                  <path d="M200,20 Q210,60 220,100 Q230,140 250,190" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
                  <path d="M200,20 Q210,60 220,100 Q230,140 250,190" fill="none" stroke="rgba(168,85,247,0.12)" strokeWidth="0.8" strokeDasharray="6 3" />
                  <text x="225" y="55" fill="rgba(168,85,247,0.22)" fontSize="7" fontFamily="monospace">NH-71</text>

                  <path d="M350,25 Q380,70 400,120 Q410,155 420,190" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" />
                  <path d="M350,25 Q380,70 400,120 Q410,155 420,190" fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="0.7" strokeDasharray="5 3" />

                  {/* Secondary roads */}
                  <path d="M100,40 Q160,55 220,50 Q290,45 350,60" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  <path d="M120,150 Q200,130 280,140 Q360,150 440,135" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

                  {/* City dot markers */}
                  <circle cx="210" cy="85" r="3" fill="rgba(168,85,247,0.15)" stroke="rgba(168,85,247,0.3)" strokeWidth="0.5" />
                  <text x="218" y="88" fill="rgba(255,255,255,0.25)" fontSize="8" fontWeight="500">Rohtak</text>

                  <circle cx="420" cy="65" r="3.5" fill="rgba(139,92,246,0.15)" stroke="rgba(139,92,246,0.35)" strokeWidth="0.5" />
                  <text x="430" y="68" fill="rgba(255,255,255,0.3)" fontSize="8" fontWeight="600">Delhi</text>

                  <circle cx="380" cy="105" r="2.5" fill="rgba(139,92,246,0.12)" stroke="rgba(139,92,246,0.25)" strokeWidth="0.5" />
                  <text x="389" y="108" fill="rgba(255,255,255,0.2)" fontSize="7">Gurugram</text>

                  <circle cx="310" cy="55" r="2" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.2)" strokeWidth="0.5" />
                  <text x="318" y="58" fill="rgba(255,255,255,0.18)" fontSize="7">Jhajjar</text>

                  <circle cx="155" cy="120" r="2" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.2)" strokeWidth="0.5" />
                  <text x="163" y="123" fill="rgba(255,255,255,0.18)" fontSize="7">Bhiwani</text>

                  <circle cx="280" cy="135" r="2" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.2)" strokeWidth="0.5" />
                  <text x="288" y="138" fill="rgba(255,255,255,0.18)" fontSize="7">Rewari</text>

                  {/* Subtle grid overlay */}
                  <defs>
                    <pattern id="mapGridDark" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(168,85,247,0.03)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#mapGridDark)" />
                </svg>

                {/* Compass */}
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full border border-purple-500/15 bg-black/30 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-[7px] font-bold text-purple-400/50">N</span>
                </div>

                {/* Vehicle GPS pins */}
                {vehicles.map((v,i) => {
                  const pos = [
                    {left:'35%',top:'45%'},{left:'55%',top:'32%'},
                    {left:'42%',top:'60%'},{left:'68%',top:'50%'},
                    {left:'28%',top:'28%'},{left:'50%',top:'70%'},
                  ][i] || {left:'50%',top:'50%'}
                  const clr = v.healthStatus==='healthy'?'green':v.healthStatus==='critical'?'red':'yellow'
                  const fill = clr==='green'?'#22c55e':clr==='red'?'#ef4444':'#eab308'
                  return (
                    <div key={v.vehicleId} className="absolute group cursor-pointer -translate-x-1/2 -translate-y-full" style={pos}
                      onClick={() => navigate(`/vehicle/${v.vehicleId}`)}>
                      <svg width="22" height="30" viewBox="0 0 24 32" className="drop-shadow-lg" style={{ filter: `drop-shadow(0 0 8px ${fill}90)` }}>
                        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill={fill} />
                        <circle cx="12" cy="11" r="5" fill="white" opacity="0.9" />
                        <circle cx="12" cy="11" r="2.5" fill={fill} />
                      </svg>
                      {/* Pulse ring */}
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-0">
                        <div className={`w-3 h-1 rounded-full bg-${clr}-400/30 animate-ping`} />
                      </div>
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2.5 py-1.5 bg-black/90 border border-purple-500/20 rounded-lg text-[9px] whitespace-nowrap z-10 shadow-[0_0_15px_-4px_rgba(168,85,247,0.35)]">
                        <p className="font-semibold text-white">{getVehicleName(v)}</p>
                        <p className="text-gray-500 capitalize mt-0.5">{v.healthStatus} {v.latestPrediction ? `• ${Math.round((v.latestPrediction.etaDays/90)*100)}%` : ''}</p>
                      </div>
                    </div>
                  )
                })}

                {/* Region labels */}
                <span className="absolute left-[25%] top-[82%] text-[10px] text-purple-400/30 font-semibold uppercase tracking-widest">Haryana</span>
                <span className="absolute left-[65%] top-[15%] text-[10px] text-purple-400/30 font-semibold uppercase tracking-widest">Delhi NCR</span>
              </div>
              <div className="flex items-center gap-5 px-5 pb-4 text-[10px] text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Active</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />Maintenance</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Attention</span>
              </div>
            </Card>

            <Card className="p-5" glow>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold">Fleet Health</h3>
                <HiChartPie className="text-gray-600 text-xs" />
              </div>
              <div className="flex flex-col items-center">
                <HealthDonut critical={criticalCount} medium={warningCount} low={healthyCount} />
                <div className="w-full mt-5 space-y-2.5">
                  {[
                    { label:'Critical', color:'bg-purple-500', shadow:'shadow-purple-500/20', pct: criticalCount },
                    { label:'Warning',  color:'bg-yellow-500', shadow:'shadow-yellow-500/20', pct: warningCount },
                    { label:'Healthy',  color:'bg-green-500',  shadow:'shadow-green-500/20',  pct: healthyCount },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${r.color} ${r.shadow} shadow-sm`} /><span className="text-[11px] text-gray-500">{r.label}</span></div>
                      <span className="text-[11px] font-semibold text-gray-300">{r.pct > 0 ? Math.round((r.pct/(vehicles.length||1))*100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* ── bottom grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 space-y-4">
              {/* vehicle status table */}
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <h3 className="text-sm font-semibold">Vehicle Status</h3>
                  <span className="text-gray-600 flex items-center gap-1 text-[10px]"><HiClipboardList className="text-[10px]" />Cases</span>
                </div>
                <div className="grid grid-cols-12 gap-2 px-5 py-2 text-[10px] font-medium text-gray-600 uppercase tracking-wider border-b border-purple-500/[0.07]">
                  <div className="col-span-3">Name</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Check-in</div>
                  <div className="col-span-2 text-right">Health</div>
                  <div className="col-span-3 text-right">Alert</div>
                </div>
                {vehicles.map(v => {
                  const pred = v.latestPrediction
                  const hp = pred ? Math.min(100, Math.max(0, Math.round((pred.etaDays/90)*100))) : null
                  const sLabel = v.healthStatus==='critical'?'Overdue':v.healthStatus==='warning'?'Maintenance':'Active'
                  const sColor = v.healthStatus==='critical'?'text-red-400':v.healthStatus==='warning'?'text-yellow-400':'text-green-400'
                  const dColor = v.healthStatus==='critical'?'bg-red-400':v.healthStatus==='warning'?'bg-yellow-400':'bg-green-400'
                  return (
                    <div key={v.vehicleId} onClick={() => navigate(`/vehicle/${v.vehicleId}`)}
                      className="grid grid-cols-12 gap-2 px-5 py-3 items-center cursor-pointer transition-all hover:bg-purple-900/10 border-b border-purple-500/5 last:border-0">
                      <div className="col-span-3"><p className="text-[13px] font-medium text-gray-200 truncate">{getVehicleName(v)}</p></div>
                      <div className="col-span-2"><span className={`flex items-center gap-1.5 text-[11px] font-medium ${sColor}`}><span className={`w-1.5 h-1.5 rounded-full ${dColor}`} />{sLabel}</span></div>
                      <div className="col-span-2 text-[11px] text-gray-600">{schedulerStatus?.simDay ? `${Math.max(0, schedulerStatus.simDay - 43)}d` : '-'}</div>
                      <div className="col-span-2 text-right">
                        <span className={`text-[13px] font-bold ${(hp??100)>=70?'text-green-400':(hp??100)>=40?'text-yellow-400':'text-red-400'}`}>{hp !== null ? `${hp}%` : '-'}</span>
                      </div>
                      <div className="col-span-3 text-right">
                        {v.healthStatus==='critical' ? <SeverityBadge level="critical" /> : v.healthStatus==='warning' ? <SeverityBadge level="medium" /> : <span className="text-[10px] text-gray-700">-</span>}
                      </div>
                    </div>
                  )
                })}
              </Card>

              {cases.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">Maintenance Cases <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">{cases.length}</span></h3>
                  </div>
                  <div className="px-5 pb-4 space-y-2">
                    {cases.slice(0,5).map(c => (
                      <div key={c.caseId} className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07] hover:bg-purple-900/15 hover:border-purple-500/15 transition-all">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.severity==='critical'?'bg-red-400':c.severity==='high'?'bg-orange-400':'bg-yellow-400'}`} />
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium truncate">{getVehicleName(vehicles.find(v=>v.vehicleId===c.vehicleId)||{vehicleId:c.vehicleId})}</p>
                            <p className="text-[10px] text-gray-600">{c.caseId} · {c.currentState}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <FailureTypeBadge predictionType={c.metadata?.predictionType} />
                          <SeverityBadge level={c.severity} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* right column */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="overflow-hidden" glow>
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <HiLightningBolt className="text-purple-400 text-xs" /> Alerts
                    {allAlerts.length > 0 && <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">{allAlerts.length}</span>}
                  </h3>
                </div>
                <div className="px-5 pb-4 space-y-1.5 max-h-72 overflow-y-auto">
                  {allAlerts.length === 0 ? (
                    <div className="text-center py-8"><HiShieldCheck className="text-2xl mx-auto mb-2 text-purple-500/20" /><p className="text-[11px] text-gray-600">All systems nominal</p></div>
                  ) : allAlerts.map((a,idx) => (
                    <div key={a.caseId||`ws-${idx}`} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07] hover:bg-purple-900/15 hover:border-purple-500/15 transition-all">
                      <HiExclamationCircle className="text-purple-400 flex-shrink-0 text-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium truncate">{getVehicleName(vehicles.find(v=>v.vehicleId===a.vehicleId)||{vehicleId:a.vehicleId})}</p>
                        <p className="text-[9px] text-gray-600">{a.etaDays ? `RUL: ${a.etaDays?.toFixed?.(1)||a.etaDays}d` : a.currentState||''}</p>
                      </div>
                      <SeverityBadge level={a.severity||'medium'} />
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <h3 className="text-sm font-semibold">Service Centers</h3>
                </div>
                <div className="px-5 pb-4 space-y-2">
                  {[
                    { name:'Tata Motors Authorized Workshop — Rohtak', type:'Authorized Dealer' },
                    { name:'Highway Fleet Service Center — NH48 Gurugram', type:'General Repairs' },
                    { name:'Ashok Leyland Service Hub — Manesar', type:'EV & Heavy Vehicle Specialist' },
                    { name:'Quick Fix Fleet Garage — Industrial Area, Rohtak', type:'Heavy Commercial Vehicles' },
                  ].map((sc,i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07] hover:bg-purple-900/15 hover:border-purple-500/15 transition-all">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center"><HiLocationMarker className="text-purple-400 text-xs" /></div>
                        <div><p className="text-[12px] font-medium">{sc.name}</p><p className="text-[10px] text-gray-600">{sc.type}</p></div>
                      </div>
                      <button className="text-[10px] font-medium text-purple-400 hover:text-purple-300 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/15 hover:shadow-[0_0_10px_-4px_rgba(168,85,247,0.3)] transition-all">Schedule</button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* ═════════ VEHICLE DETAIL SLIDE-OVER ═════════ */}
      {showPanel && selectedData && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPanel(false)} />
          <div className="relative w-full max-w-sm bg-purple-950/30 backdrop-blur-2xl border-l border-purple-500/15 h-screen overflow-y-auto shadow-[-20px_0_50px_-10px_rgba(168,85,247,0.15)]"
            style={{ animation:'slideIn .2s ease-out' }}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold">{getVehicleName(selectedData)}</h3>
                <button onClick={() => setShowPanel(false)} className="text-gray-600 hover:text-white p-1"><HiX className="text-sm" /></button>
              </div>
              <div className="flex items-center gap-2.5 mb-5">
                <SeverityBadge level={selectedData.healthStatus==='critical'?'critical':selectedData.healthStatus==='warning'?'medium':'low'} />
                <FailureTypeBadge predictionType={selectedData.latestPrediction?.predictionType} />
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                {[
                  {l:'Make / Model', v:`${selectedData.vehicleInfo?.make} ${selectedData.vehicleInfo?.model}`},
                  {l:'Year', v:selectedData.vehicleInfo?.year},
                  {l:'Avg Daily KM', v:selectedData.usageProfile?.avgDailyKm},
                  {l:'Load Pattern', v:selectedData.usageProfile?.loadPattern},
                ].map((x,i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                    <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5">{x.l}</p>
                    <p className="text-[12px] font-medium capitalize">{x.v||'-'}</p>
                  </div>
                ))}
              </div>
              {selectedData.latestPrediction && (
                <div className="mb-5">
                  <h4 className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Prediction</h4>
                  <div className="p-3 rounded-lg bg-purple-950/10 border border-purple-500/[0.07] space-y-2.5">
                    <div className="flex justify-between"><span className="text-[11px] text-gray-500">RUL</span>
                      <span className={`text-[13px] font-bold ${selectedData.latestPrediction.etaDays>=60?'text-green-400':selectedData.latestPrediction.etaDays>=21?'text-yellow-400':'text-red-400'}`}>{selectedData.latestPrediction.etaDays.toFixed(1)} days</span>
                    </div>
                    <div className="flex justify-between"><span className="text-[11px] text-gray-500">Confidence</span><span className="text-[12px] font-medium">{(selectedData.latestPrediction.confidence*100).toFixed(0)}%</span></div>
                    <div className="flex justify-between"><span className="text-[11px] text-gray-500">Type</span><span className="text-[12px] font-medium capitalize">{selectedData.latestPrediction.predictionType?.replace('_',' ')}</span></div>
                    <div className="w-full bg-purple-950/20 rounded-full h-1">
                      <div className={`h-1 rounded-full transition-all ${selectedData.latestPrediction.etaDays>=60?'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]':selectedData.latestPrediction.etaDays>=21?'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.4)]':'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]'}`}
                        style={{width:`${Math.min(100,(selectedData.latestPrediction.etaDays/90)*100)}%`}} />
                    </div>
                  </div>
                </div>
              )}
              {selectedData.latestPrediction?.modelOutputs && (
                <div>
                  <h4 className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Model Outputs</h4>
                  <div className="space-y-1.5">
                    {['dpf','scr','oil','anomaly'].map(m => {
                      const o = selectedData.latestPrediction.modelOutputs[m]
                      if (!o||o.status!=='success') return null
                      return (
                        <div key={m} className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase">{m}</span>
                          {m==='anomaly' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-500">{o.anomaly_score?.toFixed(3)}</span>
                              <span className={`text-[10px] font-semibold ${o.is_anomaly?'text-red-400':'text-green-400'}`}>{o.is_anomaly?'Anomaly':'Normal'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-mono font-semibold ${o.rul_days>=60?'text-green-400':o.rul_days>=21?'text-yellow-400':'text-red-400'}`}>{o.rul_days?.toFixed(1)}d</span>
                              <span className="text-[10px] text-gray-600">{(o.failure_probability*100).toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {selectedData.activeCase && (
                <div className="mt-5 p-3 rounded-lg bg-red-500/[0.03] border border-red-500/10">
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5">Active Case</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-red-400">{selectedData.activeCase.caseId}</span>
                    <SeverityBadge level={selectedData.activeCase.severity} />
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5">{selectedData.activeCase.currentState}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  )
}
