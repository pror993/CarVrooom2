import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { serviceCenterAPI } from '../services/api'
import {
    HiLogout, HiHome, HiCalendar, HiCog,
    HiUser, HiChevronDown, HiSearch, HiDotsHorizontal,
    HiTruck, HiExclamation, HiCheck, HiClock, HiLocationMarker,
    HiStar, HiShieldCheck, HiLightningBolt, HiFire, HiBeaker,
    HiDatabase, HiStatusOnline, HiPhone, HiMail,
    HiClipboardCheck, HiChartBar, HiAnnotation,
} from 'react-icons/hi'
import { HiWrench } from 'react-icons/hi2'

/* animated dot-grid background */
function DotGridCanvas() {
    const ref = useRef(null)
    useEffect(() => {
        const c = ref.current
        if (!c) return
        const ctx = c.getContext('2d')
        let raf, w, h
        const resize = () => {
            w = c.width = c.offsetWidth
            h = c.height = c.offsetHeight
        }
        resize()
        window.addEventListener('resize', resize)
        const cols = () => Math.ceil(w / 32)
        const rows = () => Math.ceil(h / 32)
        let t = 0
        const draw = () => {
            ctx.clearRect(0, 0, w, h)
            const C = cols(), R = rows()
            for (let r = 0; r < R; r++) {
                for (let cc = 0; cc < C; cc++) {
                    const x = cc * 32 + 16, y = r * 32 + 16
                    const d = Math.hypot(x - w / 2, y - h / 2)
                    const a = 0.08 + 0.06 * Math.sin(t * 0.8 + d * 0.008)
                    ctx.fillStyle = 'rgba(168,85,247,' + a + ')'
                    ctx.beginPath()
                    ctx.arc(x, y, 1.2, 0, Math.PI * 2)
                    ctx.fill()
                }
            }
            t += 0.02
            raf = requestAnimationFrame(draw)
        }
        draw()
        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('resize', resize)
        }
    }, [])
    return (
        <canvas
            ref={ref}
            className="fixed inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0 }}
        />
    )
}

/* reusable card */
const Card = ({ children, className = '' }) => (
    <div className={'bg-purple-950/12 backdrop-blur-md border border-purple-500/10 rounded-2xl ' + className}>
        {children}
    </div>
)

/* badges */
const SeverityBadge = ({ severity }) => {
    const m = {
        critical: 'bg-red-500/20 text-red-400',
        high: 'bg-orange-500/20 text-orange-400',
        medium: 'bg-yellow-500/20 text-yellow-400',
        low: 'bg-green-500/20 text-green-400',
    }
    return (
        <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (m[severity] || m.low)}>
            {severity}
        </span>
    )
}

const StatusBadge = ({ status }) => {
    const m = {
        confirmed: 'bg-green-500/20 text-green-400',
        pending: 'bg-yellow-500/20 text-yellow-400',
        'in-progress': 'bg-blue-500/20 text-blue-400',
        completed: 'bg-purple-500/20 text-purple-400',
    }
    return (
        <span className={'px-2.5 py-1 rounded-full text-xs font-semibold ' + (m[status] || 'bg-gray-500/20 text-gray-400')}>
            {status}
        </span>
    )
}

const TechStatusBadge = ({ status }) => {
    const m = {
        available: 'bg-green-500/20 text-green-400',
        busy: 'bg-red-500/20 text-red-400',
        break: 'bg-yellow-500/20 text-yellow-400',
    }
    return (
        <span className={'px-2.5 py-1 rounded-full text-xs font-semibold ' + (m[status] || 'bg-gray-500/20 text-gray-400')}>
            {status}
        </span>
    )
}

/* mock data */
const MOCK_TECHNICIANS = [
    {
        id: 1, name: 'Rajesh Kumar', specialization: 'EV & Hybrid Systems',
        status: 'busy', currentJob: 'Battery Health Diagnosis - HR26DQ7845',
        rating: 4.8, jobsToday: 3, avatar: 'RK',
    },
    {
        id: 2, name: 'Sunil Yadav', specialization: 'Engine & Powertrain',
        status: 'available', currentJob: null,
        rating: 4.6, jobsToday: 2, avatar: 'SY',
    },
    {
        id: 3, name: 'Amit Singh', specialization: 'Exhaust & Emission',
        status: 'busy', currentJob: 'DPF Replacement - HR26AB1234',
        rating: 4.9, jobsToday: 4, avatar: 'AS',
    },
    {
        id: 4, name: 'Vikram Sharma', specialization: 'Oil & Lubrication',
        status: 'break', currentJob: null,
        rating: 4.5, jobsToday: 1, avatar: 'VS',
    },
]

const MOCK_RCA_FEEDBACK = [
    {
        id: 1,
        vehicleReg: 'HR26DQ7845',
        caseType: 'DPF Failure',
        severity: 'critical',
        aiRootCause: 'Sustained high soot accumulation (>6.2 g/L) combined with failed regeneration cycles. Back-pressure exceeded 18 kPa threshold for 72+ hours.',
        techNotes: 'Confirmed DPF substrate cracking. Replaced with OEM unit. Recommended ECU recalibration.',
        recommendation: 'Schedule forced regeneration every 500 km for next 3 cycles. Monitor back-pressure sensor.',
        confidence: 94,
        timestamp: '2025-01-15T10:30:00Z',
    },
    {
        id: 2,
        vehicleReg: 'HR26AB1234',
        caseType: 'SCR Degradation',
        severity: 'high',
        aiRootCause: 'NOx conversion efficiency dropped to 62% due to DEF crystallization in injector nozzle. Catalyst aging factor at 0.78.',
        techNotes: 'Cleaned DEF injector. SCR catalyst still within serviceable range. Applied software update.',
        recommendation: 'Switch to ISO 22241-compliant DEF. Re-evaluate catalyst in 10,000 km.',
        confidence: 87,
        timestamp: '2025-01-14T15:45:00Z',
    },
    {
        id: 3,
        vehicleReg: 'HR55XY9012',
        caseType: 'Oil Degradation',
        severity: 'medium',
        aiRootCause: 'TBN dropped below 3.0 at 8,200 km - accelerated oxidation due to frequent short trips and incomplete warm-up cycles.',
        techNotes: 'Oil replaced with 5W-30 synthetic. No metal particles in drain sample. Engine wear normal.',
        recommendation: 'Advise owner on warm-up driving patterns. Next oil analysis at 5,000 km.',
        confidence: 91,
        timestamp: '2025-01-13T09:15:00Z',
    },
]

const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: HiHome },
    { key: 'appointments', label: 'Appointments', icon: HiCalendar },
    { key: 'technicians', label: 'Technician Bench', icon: HiWrench },
    { key: 'rca', label: 'RCA Feedback', icon: HiBeaker },
    { key: 'center', label: 'Center Info', icon: HiCog },
]

/* COMPONENT */
export default function ServiceCenterDashboard() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [section, setSection] = useState('dashboard')
    const [loading, setLoading] = useState(true)
    const [dashData, setDashData] = useState(null)
    const [error, setError] = useState(null)

    const centerId = user?.profile?.serviceCenterId
    const fetchDashboard = useCallback(async () => {
        if (!centerId) return
        try {
            setLoading(true)
            const res = await serviceCenterAPI.getDashboard(centerId)
            if (res.success) {
                setDashData(res)
            } else {
                setError(res.error || 'Failed to load dashboard data')
            }
        } catch (e) {
            console.error('Dashboard fetch failed', e)
            setError('Failed to load dashboard data')
        } finally {
            setLoading(false)
        }
    }, [centerId])

    useEffect(() => { fetchDashboard() }, [fetchDashboard])

    const handleStatusUpdate = async (caseId, newStatus) => {
        if (!centerId) return
        const res = await serviceCenterAPI.updateAppointmentStatus(centerId, caseId, newStatus)
        if (res.success) {
            fetchDashboard() // refresh data
        } else {
            alert(res.error || 'Failed to update status')
        }
    }

    const handleLogout = async () => { await logout(); navigate('/') }

    const center = dashData?.center
    const stats = dashData?.stats || {}
    const appointments = dashData?.appointments || []

    const Donut = () => {
        const total = stats.totalSlots || 12
        const booked = stats.bookedSlots || 0
        const pct = total ? Math.round((booked / total) * 100) : 0
        const r = 54
        const circ = 2 * Math.PI * r
        return (
            <div className="flex flex-col items-center">
                <svg width="140" height="140" className="transform -rotate-90">
                    <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(168,85,247,0.12)" strokeWidth="12" />
                    <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(168,85,247,0.8)" strokeWidth="12"
                        strokeDasharray={circ} strokeDashoffset={circ - (circ * pct) / 100}
                        strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <p className="mt-3 text-2xl font-bold text-white">{pct}%</p>
                <p className="text-xs text-gray-400">{booked} / {total} slots booked</p>
            </div>
        )
    }

    /* renderDashboard */
    const renderDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Today's Jobs", value: stats.todayJobs ?? 0, icon: HiCalendar, color: 'text-blue-400 bg-blue-500/15' },
                    { label: 'Confirmed', value: stats.confirmed ?? 0, icon: HiCheck, color: 'text-green-400 bg-green-500/15' },
                    { label: 'Pending', value: stats.pending ?? 0, icon: HiClock, color: 'text-yellow-400 bg-yellow-500/15' },
                    { label: 'Critical', value: stats.critical ?? 0, icon: HiExclamation, color: 'text-red-400 bg-red-500/15' },
                ].map((s) => (
                    <Card key={s.label} className="p-5">
                        <div className="flex items-center gap-4">
                            <div className={'p-3 rounded-xl ' + s.color}><s.icon className="text-2xl" /></div>
                            <div>
                                <p className="text-xs text-gray-400">{s.label}</p>
                                <p className="text-2xl font-bold">{s.value}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="p-6 lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <HiShieldCheck className="text-purple-400" /> Center Overview
                    </h3>
                    {center ? (
                        <div className="grid sm:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                                <p className="text-gray-400">Name</p>
                                <p className="font-medium">{center.name}</p>
                                <p className="text-gray-400 mt-3">Location</p>
                                <p className="font-medium">{center.location?.city}, {center.location?.state}</p>
                                <p className="text-gray-400 mt-3">Address</p>
                                <p className="font-medium text-xs text-gray-300">{center.location?.address}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-gray-400">Contact</p>
                                <p className="font-medium">{center.contact?.phone}</p>
                                <p className="text-gray-400 mt-3">Specializations</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(center.specializations || []).map((sp) => (
                                        <span key={sp} className="px-2 py-0.5 bg-purple-500/15 text-purple-300 rounded-full text-xs">{sp}</span>
                                    ))}
                                </div>
                                <p className="text-gray-400 mt-3">Rating</p>
                                <div className="flex items-center gap-1">
                                    <HiStar className="text-yellow-400" />
                                    <span className="font-medium">{center.rating?.average ?? center.rating ?? 'N/A'}</span>
                                    {center.rating?.count != null && <span className="text-xs text-gray-500">({center.rating.count})</span>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">Loading center info...</p>
                    )}
                </Card>

                <Card className="p-6 flex flex-col items-center justify-center">
                    <h3 className="text-lg font-semibold mb-4">Slot Utilization</h3>
                    <Donut />
                </Card>
            </div>

            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <HiCalendar className="text-purple-400" /> Recent Appointments
                    </h3>
                    <button onClick={() => setSection('appointments')} className="text-xs text-purple-400 hover:text-purple-300">View All &rarr;</button>
                </div>
                {appointments.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">No appointments yet</p>
                ) : (
                    <div className="space-y-3">
                        {appointments.slice(0, 5).map((a, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center"><HiTruck className="text-purple-400" /></div>
                                    <div>
                                        <p className="text-sm font-medium">{a.vehicleReg || 'Unknown'}</p>
                                        <p className="text-xs text-gray-400">{a.failureType || 'General Service'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {a.status !== 'completed' && a.caseId && (a.status === 'confirmed' || a.status === 'in-progress') && (
                                        <button
                                            onClick={() => handleStatusUpdate(a.caseId, a.status === 'confirmed' ? 'in-progress' : 'completed')}
                                            className={'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition ' + (a.status === 'confirmed' ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' : 'bg-green-500/15 text-green-400 hover:bg-green-500/25')}
                                        >
                                            {a.status === 'confirmed' ? <><HiWrench className="text-xs" /> Start</> : <><HiCheck className="text-xs" /> Done</>}
                                        </button>
                                    )}
                                    <div className="text-right">
                                        <StatusBadge status={a.status || 'pending'} />
                                        <p className="text-xs text-gray-500 mt-1">{a.date ? new Date(a.date).toLocaleDateString() : '-'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    )

    /* renderAppointments */
    const renderAppointments = () => (
        <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <HiCalendar className="text-purple-400" /> All Appointments
            </h3>
            {appointments.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-12">No appointments found for this service center.</p>
            ) : (
                <div className="space-y-3">
                    {appointments.map((a, i) => (
                        <div key={i} className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition border border-purple-500/5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center"><HiTruck className="text-purple-400" /></div>
                                    <div>
                                        <p className="font-medium">{a.vehicleReg || 'Unknown Vehicle'}</p>
                                        <p className="text-xs text-gray-400">{a.vehicleName || ''}</p>
                                    </div>
                                </div>
                                <StatusBadge status={a.status || 'pending'} />
                            </div>
                            <div className="grid sm:grid-cols-3 gap-2 text-xs text-gray-400 mt-3">
                                <div><span className="text-gray-500">Type:</span> {a.failureType || 'General'}</div>
                                <div><span className="text-gray-500">Severity:</span> <SeverityBadge severity={a.severity || 'low'} /></div>
                                <div><span className="text-gray-500">Date:</span> {a.date ? new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</div>
                            </div>
                            {a.timeSlot && <p className="text-xs text-gray-500 mt-2">{a.timeSlot}</p>}

                            {/* Action buttons */}
                            {a.status !== 'completed' && a.caseId && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-purple-500/5">
                                    {a.status === 'confirmed' && (
                                        <button
                                            onClick={() => handleStatusUpdate(a.caseId, 'in-progress')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition"
                                        >
                                            <HiWrench className="text-sm" /> Start Service
                                        </button>
                                    )}
                                    {(a.status === 'confirmed' || a.status === 'in-progress') && (
                                        <button
                                            onClick={() => handleStatusUpdate(a.caseId, 'completed')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-medium hover:bg-green-500/25 transition"
                                        >
                                            <HiCheck className="text-sm" /> Mark as Done
                                        </button>
                                    )}
                                </div>
                            )}
                            {a.status === 'completed' && (
                                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-purple-500/5 text-green-400 text-xs">
                                    <HiCheck className="text-sm" /> Service completed
                                    {a.completedAt && <span className="text-gray-500 ml-1">· {new Date(a.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Card>
    )

    /* renderTechnicians */
    const renderTechnicians = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <HiWrench className="text-purple-400" /> Technician Workbench
                </h3>
                <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">Mock Data</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Available', count: MOCK_TECHNICIANS.filter((t) => t.status === 'available').length, color: 'text-green-400' },
                    { label: 'Busy', count: MOCK_TECHNICIANS.filter((t) => t.status === 'busy').length, color: 'text-red-400' },
                    { label: 'On Break', count: MOCK_TECHNICIANS.filter((t) => t.status === 'break').length, color: 'text-yellow-400' },
                ].map((s) => (
                    <Card key={s.label} className="p-4 text-center">
                        <p className={'text-2xl font-bold ' + s.color}>{s.count}</p>
                        <p className="text-xs text-gray-400 mt-1">{s.label}</p>
                    </Card>
                ))}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                {MOCK_TECHNICIANS.map((t) => (
                    <Card key={t.id} className="p-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500/30 to-fuchsia-500/20 flex items-center justify-center text-sm font-bold text-purple-300">{t.avatar}</div>
                                <div>
                                    <p className="font-semibold">{t.name}</p>
                                    <p className="text-xs text-gray-400">{t.specialization}</p>
                                </div>
                            </div>
                            <TechStatusBadge status={t.status} />
                        </div>
                        {t.currentJob && (
                            <div className="bg-white/[0.04] rounded-lg p-3 text-xs text-gray-300 mb-3">
                                <span className="text-gray-500">Current Job:</span> {t.currentJob}
                            </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-gray-400">
                            <span className="flex items-center gap-1"><HiStar className="text-yellow-400" />{t.rating}</span>
                            <span>{t.jobsToday} jobs today</span>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )

    /* renderRCA */
    const renderRCA = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <HiBeaker className="text-purple-400" /> RCA Agent Feedback
                </h3>
                <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">Mock Data</span>
            </div>
            {MOCK_RCA_FEEDBACK.map((r) => (
                <Card key={r.id} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center"><HiTruck className="text-purple-400" /></div>
                            <div>
                                <p className="font-semibold">{r.vehicleReg}</p>
                                <p className="text-xs text-gray-400">{r.caseType}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <SeverityBadge severity={r.severity} />
                            <span className="text-xs text-gray-500">{new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                    </div>
                    <div className="space-y-4 text-sm">
                        <div className="bg-purple-500/[0.06] rounded-xl p-4 border border-purple-500/10">
                            <div className="flex items-center gap-2 mb-2">
                                <HiLightningBolt className="text-purple-400" />
                                <p className="font-medium text-purple-300 text-xs uppercase tracking-wider">AI Root Cause Analysis</p>
                                <span className="ml-auto text-xs text-purple-400 font-semibold">{r.confidence}% confidence</span>
                            </div>
                            <p className="text-gray-300 text-xs leading-relaxed">{r.aiRootCause}</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <HiAnnotation className="text-blue-400" />
                                <p className="font-medium text-blue-300 text-xs uppercase tracking-wider">Technician Notes</p>
                            </div>
                            <p className="text-gray-300 text-xs leading-relaxed">{r.techNotes}</p>
                        </div>
                        <div className="bg-green-500/[0.06] rounded-xl p-4 border border-green-500/10">
                            <div className="flex items-center gap-2 mb-2">
                                <HiClipboardCheck className="text-green-400" />
                                <p className="font-medium text-green-300 text-xs uppercase tracking-wider">Recommendation</p>
                            </div>
                            <p className="text-gray-300 text-xs leading-relaxed">{r.recommendation}</p>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    )

    /* renderCenterInfo */
    const renderCenterInfo = () => (
        <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <HiCog className="text-purple-400" /> Center Information
            </h3>
            {center ? (
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Center Name</p>
                            <p className="font-medium">{center.name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Center ID</p>
                            <p className="font-medium font-mono text-sm text-purple-300">{center.centerId}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Address</p>
                            <p className="text-sm text-gray-300">{center.location?.address}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">City / State</p>
                            <p className="font-medium">{center.location?.city}, {center.location?.state} - {center.location?.pincode}</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Phone</p>
                            <p className="font-medium flex items-center gap-2"><HiPhone className="text-purple-400" />{center.contact?.phone}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Email</p>
                            <p className="font-medium flex items-center gap-2"><HiMail className="text-purple-400" />{center.contact?.email}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Operating Hours</p>
                            {center.operatingHours?.monday ? (
                                <p className="font-medium">
                                    Mon–Fri {center.operatingHours.monday.open} – {center.operatingHours.monday.close}
                                    {center.operatingHours.saturday && !center.operatingHours.saturday.closed && (
                                        <span className="text-gray-400 text-xs ml-2">| Sat {center.operatingHours.saturday.open} – {center.operatingHours.saturday.close}</span>
                                    )}
                                </p>
                            ) : (
                                <p className="font-medium">{typeof center.operatingHours === 'string' ? center.operatingHours : '9 AM - 6 PM'}</p>
                            )}
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-2">Specializations</p>
                            <div className="flex flex-wrap gap-2">
                                {(center.specializations || []).map((sp) => (
                                    <span key={sp} className="px-2.5 py-1 bg-purple-500/15 text-purple-300 rounded-full text-xs">{sp}</span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-2">Capacity</p>
                            <p className="font-medium">{center.capacity?.maxAppointmentsPerDay || '-'} appointments/day ({center.capacity?.maxAppointmentsPerSlot || '-'} per slot)</p>
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-gray-500 text-sm text-center py-8">Center info not available</p>
            )}
        </Card>
    )

    const sections = {
        dashboard: renderDashboard,
        appointments: renderAppointments,
        technicians: renderTechnicians,
        rca: renderRCA,
        center: renderCenterInfo,
    }

    /* RENDER */
    return (
        <div className="relative min-h-screen bg-[#09090b] text-white overflow-hidden">
            <DotGridCanvas />
            <div className="relative z-10 flex">
                <aside className="fixed top-0 left-0 h-screen w-60 border-r border-purple-500/10 bg-[#09090b]/80 backdrop-blur-xl flex flex-col">
                    <div className="p-6 border-b border-purple-500/10 cursor-pointer" onClick={() => navigate('/')}>
                        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                            AfterCare AI&trade;
                        </h1>
                        <p className="text-[10px] text-gray-500 mt-0.5">Service Center</p>
                    </div>
                    <nav className="flex-1 p-3 space-y-1">
                        {NAV.map((n) => (
                            <button
                                key={n.key}
                                onClick={() => setSection(n.key)}
                                className={'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ' + (section === n.key ? 'bg-purple-500/15 text-purple-300' : 'text-gray-400 hover:bg-white/5 hover:text-white')}
                            >
                                <n.icon className="text-lg" />
                                {n.label}
                            </button>
                        ))}
                    </nav>
                    <div className="p-4 border-t border-purple-500/10 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold">
                                {(user?.profile?.name || user?.email || 'SC').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium truncate">{user?.profile?.name || 'Service Center'}</p>
                                <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                            <HiLogout /> Sign Out
                        </button>
                    </div>
                </aside>

                <main className="ml-60 flex-1 p-8 min-h-screen">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold">{NAV.find((n) => n.key === section)?.label}</h2>
                            <p className="text-sm text-gray-500 mt-1">{center?.name || 'Loading...'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input placeholder="Search..." className="pl-9 pr-4 py-2 w-56 rounded-xl bg-white/5 border border-purple-500/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/30" />
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                        </div>
                    ) : error ? (
                        <Card className="p-8 text-center">
                            <HiExclamation className="text-4xl text-red-400 mx-auto mb-3" />
                            <p className="text-red-400">{error}</p>
                            <button onClick={fetchDashboard} className="mt-4 px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg text-sm hover:bg-purple-500/30 transition">Retry</button>
                        </Card>
                    ) : (
                        sections[section]()
                    )}
                </main>
            </div>
        </div>
    )
}
