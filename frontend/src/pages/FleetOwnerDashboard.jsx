import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { pipelineAPI } from '../services/api'
import { usePipelineSocket } from '../services/usePipelineSocket'
import {
  HiChartBar, HiLogout, HiTruck, HiExclamation, HiCheck,
  HiPlay, HiStop, HiRefresh, HiClock, HiStatusOnline,
  HiLightningBolt, HiShieldCheck, HiExclamationCircle, HiUser,
} from 'react-icons/hi'

// ── Health status badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    healthy:  { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-500/30', label: 'Healthy', icon: HiShieldCheck },
    warning:  { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Warning', icon: HiExclamation },
    critical: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-500/30', label: 'Critical', icon: HiExclamationCircle },
    unknown:  { bg: 'bg-gray-900/30', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Pending', icon: HiClock },
  }
  const c = config[status] || config.unknown
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}>
      <Icon className="w-3.5 h-3.5" />
      {c.label}
    </span>
  )
}

// ── Vehicle Card ─────────────────────────────────────────────────
function VehicleCard({ vehicle, isSelected, onClick }) {
  const pred = vehicle.latestPrediction
  const activeCase = vehicle.activeCase

  return (
    <div
      onClick={onClick}
      className={`relative p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-purple-500/50 bg-purple-900/10 ring-1 ring-purple-500/20'
          : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900'
      }`}
    >
      {/* Alert badge */}
      {activeCase && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            vehicle.healthStatus === 'healthy' ? 'bg-green-900/20' :
            vehicle.healthStatus === 'critical' ? 'bg-red-900/20' :
            vehicle.healthStatus === 'warning' ? 'bg-yellow-900/20' : 'bg-gray-800'
          }`}>
            <HiTruck className={`text-xl ${
              vehicle.healthStatus === 'healthy' ? 'text-green-400' :
              vehicle.healthStatus === 'critical' ? 'text-red-400' :
              vehicle.healthStatus === 'warning' ? 'text-yellow-400' : 'text-gray-500'
            }`} />
          </div>
          <div>
            <h4 className="font-semibold text-sm">{vehicle.vehicleId}</h4>
            <p className="text-xs text-gray-500">
              {vehicle.vehicleInfo?.make} {vehicle.vehicleInfo?.model}
            </p>
          </div>
        </div>
        <StatusBadge status={vehicle.healthStatus} />
      </div>

      {/* Prediction info */}
      {pred ? (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">RUL</span>
            <span className={`font-mono font-semibold ${
              pred.etaDays >= 60 ? 'text-green-400' :
              pred.etaDays >= 21 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {pred.etaDays.toFixed(1)} days
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Confidence</span>
            <span className="text-gray-300 font-mono">{(pred.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Type</span>
            <span className="text-gray-300 capitalize">{pred.predictionType?.replace('_', ' ')}</span>
          </div>
          {/* RUL bar */}
          <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
            <div
              className={`h-1.5 rounded-full transition-all ${
                pred.etaDays >= 60 ? 'bg-green-500' :
                pred.etaDays >= 21 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, (pred.etaDays / 90) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-600 italic">No predictions yet</p>
      )}

      {/* Active case */}
      {activeCase && (
        <div className="mt-3 p-2 bg-red-900/10 border border-red-900/30 rounded-lg">
          <p className="text-xs text-red-400 font-medium">
            ⚠ Case: {activeCase.caseId} — {activeCase.severity}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Alert Item ───────────────────────────────────────────────────
function AlertItem({ alert }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-red-900/10 border border-red-900/20 rounded-lg">
      <HiLightningBolt className="text-red-400 text-lg mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-red-300">
          {alert.vehicleId} — {alert.predictionType?.replace('_', ' ')}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          RUL: {alert.etaDays?.toFixed(1)}d | Severity: {alert.severity} | Case: {alert.caseId}
        </p>
      </div>
    </div>
  )
}

// ── Model Output Row ─────────────────────────────────────────────
function ModelRow({ name, output }) {
  if (!output || output.status !== 'success') return null
  const isAnomaly = name === 'anomaly'
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-xs font-medium text-gray-300 uppercase w-20">{name}</span>
      {isAnomaly ? (
        <>
          <span className="text-xs text-gray-400">Score: {output.anomaly_score?.toFixed(3)}</span>
          <span className={`text-xs font-medium ${output.is_anomaly ? 'text-red-400' : 'text-green-400'}`}>
            {output.is_anomaly ? 'Anomaly' : 'Normal'}
          </span>
        </>
      ) : (
        <>
          <span className={`text-xs font-mono ${
            output.rul_days >= 60 ? 'text-green-400' :
            output.rul_days >= 21 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {output.rul_days?.toFixed(1)}d
          </span>
          <span className="text-xs text-gray-400">
            {(output.failure_probability * 100).toFixed(0)}% prob
          </span>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
function FleetOwnerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { connected, alerts: wsAlerts, tickInfo } = usePipelineSocket()

  const [vehicles, setVehicles] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [schedulerStatus, setSchedulerStatus] = useState(null)
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [vehiclesRes, statusRes, casesRes] = await Promise.all([
        pipelineAPI.getVehicles(),
        pipelineAPI.getStatus(),
        pipelineAPI.getCases('active'),
      ])

      if (vehiclesRes.success) setVehicles(vehiclesRes.data)
      if (statusRes.success) setSchedulerStatus(statusRes.data)
      if (casesRes.success) setCases(casesRes.data)
    } catch (e) {
      console.error('Fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000) // Refresh every 15s
    return () => clearInterval(interval)
  }, [fetchData])

  // Re-fetch when tick happens
  useEffect(() => {
    if (tickInfo) fetchData()
  }, [tickInfo, fetchData])

  // Scheduler controls
  const handleStart = async () => {
    setActionLoading(true)
    await pipelineAPI.start()
    await fetchData()
    setActionLoading(false)
  }

  const handleStop = async () => {
    setActionLoading(true)
    await pipelineAPI.stop()
    await fetchData()
    setActionLoading(false)
  }

  const handleReset = async () => {
    if (!confirm('Reset scheduler and clear all prediction/case data?')) return
    setActionLoading(true)
    await pipelineAPI.reset(true)
    await fetchData()
    setActionLoading(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // Stats
  const healthyCount = vehicles.filter(v => v.healthStatus === 'healthy').length
  const warningCount = vehicles.filter(v => v.healthStatus === 'warning').length
  const criticalCount = vehicles.filter(v => v.healthStatus === 'critical').length
  const activeCaseCount = cases.length

  const selectedVehicleData = selectedVehicle
    ? vehicles.find(v => v.vehicleId === selectedVehicle)
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading fleet data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Header ── */}
      <nav className="border-b border-gray-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              AfterCare AI™
            </h1>
            <span className="text-xs text-gray-500 border-l border-gray-700 pl-4">
              Fleet Monitoring
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Connection indicator */}
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-gray-500">{connected ? 'Live' : 'Offline'}</span>
            </div>
            <span className="text-sm text-gray-400">{user?.profile?.name || user?.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-sm transition-colors"
            >
              <HiLogout className="text-sm" /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <HiTruck className="text-2xl text-blue-400" />
              <div>
                <p className="text-xs text-gray-500">Total Vehicles</p>
                <p className="text-2xl font-bold">{vehicles.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <HiShieldCheck className="text-2xl text-green-400" />
              <div>
                <p className="text-xs text-gray-500">Healthy</p>
                <p className="text-2xl font-bold text-green-400">{healthyCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <HiExclamation className="text-2xl text-yellow-400" />
              <div>
                <p className="text-xs text-gray-500">Warning</p>
                <p className="text-2xl font-bold text-yellow-400">{warningCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <HiExclamationCircle className="text-2xl text-red-400" />
              <div>
                <p className="text-xs text-gray-500">Critical</p>
                <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <HiLightningBolt className="text-2xl text-orange-400" />
              <div>
                <p className="text-xs text-gray-500">Active Cases</p>
                <p className="text-2xl font-bold text-orange-400">{activeCaseCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Scheduler Controls ── */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <HiStatusOnline className={`text-lg ${schedulerStatus?.isRunning ? 'text-green-400 animate-pulse' : 'text-gray-500'}`} />
                <span className="text-sm font-medium">
                  {schedulerStatus?.isRunning ? 'Pipeline Running' : 'Pipeline Stopped'}
                </span>
              </div>
              {schedulerStatus && (
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Tick #{schedulerStatus.tickCount || 0}</span>
                  <span>Day {schedulerStatus.simDay || 0}/60</span>
                  <span>Row {schedulerStatus.currentRowIndex || 0}/{schedulerStatus.maxRows || 17280}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!schedulerStatus?.isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  <HiPlay /> Start
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  <HiStop /> Stop
                </button>
              )}
              <button
                onClick={handleReset}
                disabled={actionLoading || schedulerStatus?.isRunning}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                <HiRefresh /> Reset
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {schedulerStatus && (
            <div className="mt-3">
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((schedulerStatus.currentRowIndex || 0) / (schedulerStatus.maxRows || 17280)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Vehicle grid */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <HiTruck className="text-gray-500" />
              Fleet Vehicles
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {vehicles.map(v => (
                <VehicleCard
                  key={v.vehicleId}
                  vehicle={v}
                  isSelected={selectedVehicle === v.vehicleId}
                  onClick={() => setSelectedVehicle(
                    selectedVehicle === v.vehicleId ? null : v.vehicleId
                  )}
                />
              ))}
            </div>

            {/* Selected vehicle detail */}
            {selectedVehicleData && (
              <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {selectedVehicleData.vehicleId} — Detail
                  </h3>
                  <button
                    onClick={() => setSelectedVehicle(null)}
                    className="text-gray-500 hover:text-gray-300 text-sm"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Vehicle info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Make / Model</p>
                    <p className="text-sm font-medium">
                      {selectedVehicleData.vehicleInfo?.make} {selectedVehicleData.vehicleInfo?.model}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Year</p>
                    <p className="text-sm font-medium">{selectedVehicleData.vehicleInfo?.year}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Daily KM</p>
                    <p className="text-sm font-medium">{selectedVehicleData.usageProfile?.avgDailyKm}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Load Pattern</p>
                    <p className="text-sm font-medium capitalize">{selectedVehicleData.usageProfile?.loadPattern}</p>
                  </div>
                </div>

                {/* Model outputs */}
                {selectedVehicleData.latestPrediction?.modelOutputs && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Model Outputs</p>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      {['dpf', 'scr', 'oil', 'anomaly'].map(model => (
                        <ModelRow
                          key={model}
                          name={model}
                          output={selectedVehicleData.latestPrediction.modelOutputs[model]}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Alerts feed */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <HiLightningBolt className="text-red-400" />
              Live Alerts
              {wsAlerts.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-900/30 text-red-400 text-xs rounded-full">
                  {wsAlerts.length}
                </span>
              )}
            </h3>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {wsAlerts.length === 0 && cases.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <HiCheck className="text-4xl mx-auto mb-2" />
                  <p className="text-sm">No alerts — all systems nominal</p>
                </div>
              ) : (
                <>
                  {/* WebSocket alerts (real-time) */}
                  {wsAlerts.map((alert, idx) => (
                    <AlertItem key={`ws-${idx}`} alert={alert} />
                  ))}
                  {/* Persisted cases */}
                  {cases.map(c => (
                    <div key={c.caseId} className="p-3 bg-gray-900/50 border border-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{c.vehicleId}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          c.severity === 'critical' ? 'bg-red-900/30 text-red-400' :
                          c.severity === 'high' ? 'bg-orange-900/30 text-orange-400' :
                          c.severity === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-gray-800 text-gray-400'
                        }`}>
                          {c.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {c.caseId} • {c.currentState} • {c.metadata?.predictionType?.replace('_', ' ')}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FleetOwnerDashboard
