import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  HiArrowLeft, HiChatAlt2, HiPaperAirplane, HiRefresh,
  HiFire, HiBeaker, HiDatabase, HiLightningBolt, HiStatusOnline,
  HiShieldCheck, HiExclamationCircle, HiClock, HiCalendar,
  HiLocationMarker, HiChevronDown, HiChevronUp, HiTruck,
  HiCog, HiChartBar, HiX, HiCheckCircle, HiInformationCircle,
  HiPhone, HiMicrophone, HiVolumeUp
} from 'react-icons/hi'
import { pipelineAPI, chatAPI, schedulingAPI, voiceAPI } from '../services/api'

/* ═══════════════════════════════════════════════════════════════ */
/*  CONSTANTS                                                     */
/* ═══════════════════════════════════════════════════════════════ */

const VEHICLE_NAMES = {
  VH_HEALTHY:  'Tata Prima 4928.S',
  VH_DPF_FAIL: 'Tata Prima 4928.S II',
  VH_SCR_FAIL: 'Tata Signa 4825.TK',
  VH_OIL_FAIL: 'Tata Prima 4028.S',
  VH_ANOMALY:  'Ashok Leyland Captain',
  VH_CASCADE:  'Tata Prima 5530.S',
}

const VEHICLE_IMAGES = {
  VH_HEALTHY:   '/vehicles/tata-prima-4928s.jpg',
  VH_DPF_FAIL:  '/vehicles/tata-prima-4928s-ii.jpg',
  VH_SCR_FAIL:  '/vehicles/tata-signa-4825tk.jpg',
  VH_OIL_FAIL:  '/vehicles/tata-prima-4028s.jpg',
  VH_ANOMALY:   '/vehicles/ashok-leyland-captain.jpg',
  VH_CASCADE:   '/vehicles/tata-prima-5530s.jpg',
}

const FAILURE_META = {
  dpf_failure:       { icon: HiFire,          label: 'DPF Failure',      color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  scr_failure:       { icon: HiBeaker,        label: 'SCR Failure',      color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20' },
  oil_failure:       { icon: HiDatabase,      label: 'Oil Failure',      color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  cascade_failure:   { icon: HiLightningBolt, label: 'Cascade Failure',  color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
  anomaly_detection: { icon: HiStatusOnline,  label: 'Anomaly Detected', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  anomaly:           { icon: HiStatusOnline,  label: 'Anomaly Detected', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  healthy:           { icon: HiShieldCheck,   label: 'Healthy',          color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  single_failure:    { icon: HiExclamationCircle, label: 'Single Failure', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
}

/* ═══════════════════════════════════════════════════════════════ */
/*  DOT GRID BACKGROUND (shared with dashboard)                   */
/* ═══════════════════════════════════════════════════════════════ */

function DotGridCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return
    const ctx = cvs.getContext('2d')
    let raf, dots = []
    const SPACING = 32, DOT_R = 1.2

    function resize() { cvs.width = cvs.offsetWidth; cvs.height = cvs.offsetHeight; buildDots() }
    function buildDots() {
      dots = []
      for (let x = SPACING; x < cvs.width; x += SPACING)
        for (let y = SPACING; y < cvs.height; y += SPACING)
          dots.push({ x, y, phase: Math.random() * Math.PI * 2, speed: 0.003 + Math.random() * 0.006, bright: Math.random() < 0.06 })
    }

    function draw(t) {
      ctx.clearRect(0, 0, cvs.width, cvs.height)
      for (const d of dots) {
        if (d.bright) {
          const pulse = 0.25 + 0.75 * ((Math.sin(t * d.speed + d.phase) + 1) / 2)
          const hue = 250 + Math.sin(t * 0.001 + d.phase) * 20
          const r = DOT_R + pulse * 2
          const grd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r * 5)
          grd.addColorStop(0, `hsla(${hue},80%,70%,${pulse * 0.5})`)
          grd.addColorStop(1, 'transparent')
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(d.x, d.y, r * 5, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = `hsla(${hue},80%,75%,${pulse})`; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.arc(d.x, d.y, DOT_R, 0, Math.PI * 2); ctx.fill()
        }
      }
      raf = requestAnimationFrame(draw)
    }
    resize(); raf = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}

/* ═══════════════════════════════════════════════════════════════ */
/*  GLASS CARD                                                    */
/* ═══════════════════════════════════════════════════════════════ */

function Card({ children, className = '', glow = false }) {
  return (
    <div className={`rounded-2xl border border-purple-500/10 bg-purple-950/12 backdrop-blur-md ${glow ? 'shadow-[0_0_40px_-10px_rgba(168,85,247,0.2)]' : 'shadow-[0_0_20px_-8px_rgba(168,85,247,0.08)]'} ${className}`}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  RUL GAUGE                                                     */
/* ═══════════════════════════════════════════════════════════════ */

function RULGauge({ days, max = 90 }) {
  const pct = Math.min(100, Math.max(0, (days / max) * 100))
  const color = days >= 60 ? '#22c55e' : days >= 21 ? '#eab308' : '#ef4444'
  const glowColor = days >= 60 ? 'rgba(34,197,94,0.4)' : days >= 21 ? 'rgba(234,179,8,0.4)' : 'rgba(239,68,68,0.4)'
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(168,85,247,0.08)" strokeWidth="8" />
        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${glowColor})`, transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{days?.toFixed(1)}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">days RUL</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  VOICE CALL ORBS — Animated ripple/pulse for call UI           */
/* ═══════════════════════════════════════════════════════════════ */

function VoiceOrb({ state, analyserRef }) {
  // state: 'idle' | 'listening' | 'thinking' | 'speaking'
  const canvasRef = useRef(null)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    const SIZE = 220
    cvs.width = SIZE * 2; cvs.height = SIZE * 2
    const cx = SIZE, cy = SIZE
    let raf

    function draw(t) {
      ctx.clearRect(0, 0, cvs.width, cvs.height)

      // Analyser data for waveform
      let avgFreq = 0
      if (analyserRef?.current && (state === 'listening' || state === 'speaking')) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        avgFreq = data.reduce((a, b) => a + b, 0) / data.length / 255
      }

      const baseR = 55
      const pulseAmp = state === 'listening' ? 12 + avgFreq * 30
        : state === 'speaking' ? 8 + avgFreq * 25
        : state === 'thinking' ? 5
        : 3

      // Outer rings (ripples)
      const ringCount = state === 'idle' ? 2 : 4
      for (let i = ringCount; i >= 1; i--) {
        const phase = (t * 0.001 + i * 0.8) % (Math.PI * 2)
        const ripple = Math.sin(phase) * 0.5 + 0.5
        const r = baseR + i * 18 + ripple * pulseAmp
        const alpha = state === 'idle'
          ? 0.03 + ripple * 0.02
          : state === 'thinking'
          ? 0.04 + ripple * 0.04
          : 0.06 + ripple * 0.08

        const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r)
        const hue = state === 'listening' ? 270 : state === 'speaking' ? 250 : state === 'thinking' ? 280 : 260
        grad.addColorStop(0, `hsla(${hue}, 80%, 65%, ${alpha * 1.5})`)
        grad.addColorStop(0.7, `hsla(${hue}, 70%, 55%, ${alpha})`)
        grad.addColorStop(1, `hsla(${hue}, 60%, 40%, 0)`)
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill()
      }

      // Waveform ring for listening/speaking
      if ((state === 'listening' || state === 'speaking') && analyserRef?.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteTimeDomainData(data)
        const waveR = baseR + 8

        ctx.beginPath()
        ctx.strokeStyle = state === 'listening'
          ? `rgba(192, 132, 252, ${0.4 + avgFreq * 0.5})`
          : `rgba(168, 85, 247, ${0.4 + avgFreq * 0.5})`
        ctx.lineWidth = 2
        for (let i = 0; i < data.length; i++) {
          const angle = (i / data.length) * Math.PI * 2
          const v = (data[i] - 128) / 128
          const r2 = waveR + v * (15 + avgFreq * 20)
          const x = cx + Math.cos(angle) * r2
          const y = cy + Math.sin(angle) * r2
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.closePath(); ctx.stroke()
      }

      // Core orb
      const coreR = baseR + Math.sin(t * 0.003) * 3
      const coreGrad = ctx.createRadialGradient(cx - 10, cy - 10, 0, cx, cy, coreR)
      if (state === 'listening') {
        coreGrad.addColorStop(0, 'rgba(192, 132, 252, 0.95)')
        coreGrad.addColorStop(0.6, 'rgba(147, 51, 234, 0.85)')
        coreGrad.addColorStop(1, 'rgba(107, 33, 168, 0.7)')
      } else if (state === 'speaking') {
        coreGrad.addColorStop(0, 'rgba(168, 85, 247, 0.95)')
        coreGrad.addColorStop(0.6, 'rgba(126, 34, 206, 0.85)')
        coreGrad.addColorStop(1, 'rgba(88, 28, 135, 0.7)')
      } else if (state === 'thinking') {
        const shift = Math.sin(t * 0.004) * 0.15
        coreGrad.addColorStop(0, `rgba(192, 132, 252, ${0.7 + shift})`)
        coreGrad.addColorStop(0.6, `rgba(147, 51, 234, ${0.6 + shift})`)
        coreGrad.addColorStop(1, `rgba(107, 33, 168, ${0.5 + shift})`)
      } else {
        coreGrad.addColorStop(0, 'rgba(147, 51, 234, 0.5)')
        coreGrad.addColorStop(0.6, 'rgba(107, 33, 168, 0.4)')
        coreGrad.addColorStop(1, 'rgba(76, 29, 149, 0.3)')
      }
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fillStyle = coreGrad; ctx.fill()

      // Inner glow
      ctx.beginPath(); ctx.arc(cx - 12, cy - 12, coreR * 0.45, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill()

      // Thinking spinner
      if (state === 'thinking') {
        const dots = 8
        for (let i = 0; i < dots; i++) {
          const angle = (i / dots) * Math.PI * 2 + t * 0.004
          const dr = baseR + 18
          const dx = cx + Math.cos(angle) * dr
          const dy = cy + Math.sin(angle) * dr
          const alpha2 = 0.2 + 0.6 * ((Math.sin(t * 0.006 + i) + 1) / 2)
          ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(192, 132, 252, ${alpha2})`; ctx.fill()
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [state, analyserRef])

  return <canvas ref={canvasRef} className="w-[220px] h-[220px]" style={{ imageRendering: 'auto' }} />
}

/* ═══════════════════════════════════════════════════════════════ */
/*  CHATBOT (with Voice Call mode)                                */
/* ═══════════════════════════════════════════════════════════════ */

function Chatbot({ vehicleId, vehicleName, isOpen, onClose, proactiveAlert, onBookingComplete, initMode = 'chat' }) {
  const [mode, setMode] = useState(initMode) // 'chat' | 'call'
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [welcomed, setWelcomed] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // ─── Voice call state ───────────────────────────────────────
  const [callState, setCallState] = useState('idle') // 'idle' | 'listening' | 'thinking' | 'speaking'
  const callStateRef = useRef('idle') // mirror to avoid stale closures
  const [callActive, setCallActive] = useState(false)
  const [callTranscript, setCallTranscript] = useState('')
  const [callCaption, setCallCaption] = useState('Tap the mic to start')
  const [callDuration, setCallDuration] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const ttsAudioRef = useRef(null)
  const callTimerRef = useRef(null)
  const callHistoryRef = useRef([])

  // Keep callStateRef in sync
  useEffect(() => { callStateRef.current = callState }, [callState])

  // Sync mode with initMode prop
  useEffect(() => { if (isOpen) setMode(initMode) }, [initMode, isOpen])

  // Auto-scroll chat
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (isOpen && mode === 'chat') setTimeout(() => inputRef.current?.focus(), 200) }, [isOpen, mode])

  // Call duration timer
  useEffect(() => {
    if (callActive) {
      setCallDuration(0)
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
    } else {
      clearInterval(callTimerRef.current)
    }
    return () => clearInterval(callTimerRef.current)
  }, [callActive])

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      endCall()
    }
  }, [isOpen])

  // Welcome message for chat mode
  useEffect(() => {
    if (!isOpen || welcomed) return
    setWelcomed(true)
    setMessages([{ role: 'assistant', content: '...', loading: true }])
    chatAPI.getWelcome(vehicleId).then(res => {
      if (res.success) {
        setMessages([{ role: 'assistant', content: res.reply }])
      } else {
        setMessages([{ role: 'assistant', content: `Welcome! I'm AfterCare AI, your vehicle assistant for **${vehicleName}**. I couldn't connect to the AI service right now, but you can still ask me questions and I'll try when the service is back.` }])
      }
    }).catch(() => {
      setMessages([{ role: 'assistant', content: `Hello! I'm your AfterCare AI assistant for **${vehicleName}**. The AI service seems to be offline. Please make sure Ollama is running.` }])
    })
  }, [isOpen, welcomed, vehicleId, vehicleName])

  // Proactive alert
  useEffect(() => {
    if (proactiveAlert && isOpen && messages.length > 0) {
      const alreadyHasAlert = messages.some(m => m.isAlert)
      if (!alreadyHasAlert) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ **Urgent Alert from Communication Agent:**\n\n${proactiveAlert}`, isAlert: true }])
      }
    }
  }, [proactiveAlert, isOpen, messages.length])

  // ─── Chat send ──────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg = { role: 'user', content: text }
    const history = [...messages.filter(m => !m.loading), userMsg]
    setMessages(prev => [...prev.filter(m => !m.loading), userMsg, { role: 'assistant', content: '...', loading: true }])
    setLoading(true)
    try {
      const res = await chatAPI.sendMessage(vehicleId, text, history.map(m => ({ role: m.role, content: m.content })))
      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading)
        return [...filtered, { role: 'assistant', content: res.success ? res.reply : 'Sorry, I encountered an error. Please try again.' }]
      })
      if (res.bookingResult?.success && onBookingComplete) onBookingComplete(res.bookingResult)
    } catch {
      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading)
        return [...filtered, { role: 'assistant', content: 'Connection error. Make sure the server and Ollama are running.' }]
      })
    } finally { setLoading(false) }
  }, [input, loading, messages, vehicleId])

  // ─── Voice: start call ──────────────────────────────────────
  const startCall = useCallback(async () => {
    try {
      setCallActive(true)
      setCallState('idle')
      setCallTranscript('')
      setCallCaption('Connected • Tap mic to speak')
      callHistoryRef.current = []

      // Initialize AudioContext + Analyser
      const actx = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = actx
      const analyser = actx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      // Get mic stream (keep alive for analyser visualization)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const source = actx.createMediaStreamSource(stream)
      source.connect(analyser)
      sourceRef.current = source
    } catch (err) {
      console.error('Mic access error:', err)
      setCallCaption('Microphone access denied')
      setCallActive(false)
    }
  }, [])

  // ─── Voice: end call ────────────────────────────────────────
  const endCall = useCallback(() => {
    setCallActive(false)
    setCallState('idle')
    setCallTranscript('')
    setCallCaption('Tap the mic to start')

    // Stop TTS (could be AudioBufferSourceNode or Audio element)
    if (ttsAudioRef.current) {
      try { ttsAudioRef.current.stop?.() } catch {}
      try { ttsAudioRef.current.pause?.() } catch {}
      ttsAudioRef.current = null
    }

    // Stop recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    mediaRecorderRef.current = null

    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    // Disconnect audio nodes
    if (sourceRef.current) { try { sourceRef.current.disconnect() } catch {} sourceRef.current = null }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null }
    analyserRef.current = null
  }, [])

  // ─── Play base64 audio (must be defined before startListening) ──
  const ttsBufferSourceRef = useRef(null)
  const playBase64Audio = useCallback((b64) => {
    return new Promise(async (resolve) => {
      try {
        // Decode base64 → ArrayBuffer → AudioBuffer for Web Audio API playback
        const binaryStr = atob(b64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
        const arrayBuffer = bytes.buffer

        if (audioContextRef.current && analyserRef.current) {
          // Resume context if suspended (browser autoplay policy)
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume()
          }

          // Disconnect mic from analyser during TTS playback
          if (sourceRef.current) { try { sourceRef.current.disconnect() } catch {} }

          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0))
          const bufferSource = audioContextRef.current.createBufferSource()
          bufferSource.buffer = audioBuffer
          ttsBufferSourceRef.current = bufferSource

          // Route: bufferSource → analyser → speakers
          bufferSource.connect(analyserRef.current)
          analyserRef.current.connect(audioContextRef.current.destination)

          bufferSource.onended = () => {
            ttsBufferSourceRef.current = null
            ttsAudioRef.current = null
            // Reconnect mic to analyser (without destination to avoid echo)
            if (sourceRef.current && analyserRef.current) {
              try {
                analyserRef.current.disconnect()
                sourceRef.current.connect(analyserRef.current)
              } catch {}
            }
            resolve()
          }

          bufferSource.start(0)
          ttsAudioRef.current = bufferSource
        } else {
          // Fallback: plain Audio element if no AudioContext
          const audio = new Audio(`data:audio/wav;base64,${b64}`)
          ttsAudioRef.current = audio
          audio.onended = () => { ttsAudioRef.current = null; resolve() }
          audio.onerror = () => { ttsAudioRef.current = null; resolve() }
          audio.play().catch(() => { ttsAudioRef.current = null; resolve() })
        }
      } catch (err) {
        console.error('TTS playback error:', err)
        // Final fallback: try plain Audio element
        try {
          const audio = new Audio(`data:audio/wav;base64,${b64}`)
          ttsAudioRef.current = audio
          audio.onended = () => { ttsAudioRef.current = null; resolve() }
          audio.onerror = () => { ttsAudioRef.current = null; resolve() }
          audio.play().catch(() => { ttsAudioRef.current = null; resolve() })
        } catch {
          ttsAudioRef.current = null
          resolve()
        }
      }
    })
  }, [])

  // ─── Voice: start listening (record) ───────────────────────
  const startListening = useCallback(() => {
    // Use ref to avoid stale closure — always read the LATEST callState
    const currentState = callStateRef.current
    if (!streamRef.current || currentState === 'thinking' || currentState === 'speaking') {
      console.log('[Voice] startListening blocked — state:', currentState, 'stream:', !!streamRef.current)
      return
    }

    // Check stream tracks are still alive
    const tracks = streamRef.current.getAudioTracks()
    if (!tracks.length || tracks[0].readyState === 'ended') {
      console.warn('[Voice] Mic stream tracks ended — cannot record')
      setCallCaption('Mic lost — hang up and call again')
      return
    }

    // Stop any playing TTS (AudioBufferSourceNode uses .stop(), Audio element uses .pause())
    if (ttsAudioRef.current) {
      try { ttsAudioRef.current.stop?.() } catch {}
      try { ttsAudioRef.current.pause?.() } catch {}
      ttsAudioRef.current = null
    }

    // Ensure mic is connected to analyser for VoiceOrb visualization
    if (sourceRef.current && analyserRef.current) {
      try { sourceRef.current.connect(analyserRef.current) } catch {}
    }

    setCallState('listening')
    setCallCaption('Listening...')
    setCallTranscript('')
    audioChunksRef.current = []

    const mr = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm;codecs=opus' })
    mediaRecorderRef.current = mr

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }

    mr.onstop = async () => {
      if (audioChunksRef.current.length === 0) { setCallState('idle'); setCallCaption('Tap mic to speak'); return }
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      audioChunksRef.current = []

      // STT
      setCallState('thinking')
      setCallCaption('Processing...')
      try {
        const sttRes = await voiceAPI.speechToText(blob)
        if (!sttRes.success || !sttRes.transcript?.trim()) {
          setCallCaption('Didn\'t catch that — tap mic to try again')
          setCallState('idle')
          return
        }

        const transcript = sttRes.transcript.trim()
        setCallTranscript(transcript)
        setCallCaption('Thinking...')

        // Send to chat API with voice call history
        callHistoryRef.current.push({ role: 'user', content: transcript })
        const chatRes = await chatAPI.sendMessage(vehicleId, transcript, callHistoryRef.current)

        if (!chatRes.success) {
          setCallCaption('Error getting response — tap mic to try again')
          setCallState('idle')
          return
        }

        const reply = chatRes.reply
        callHistoryRef.current.push({ role: 'assistant', content: reply })
        if (chatRes.bookingResult?.success && onBookingComplete) onBookingComplete(chatRes.bookingResult)

        // TTS
        setCallState('speaking')
        setCallCaption('Speaking...')
        setCallTranscript(reply)

        const ttsRes = await voiceAPI.textToSpeech(reply)
        if (ttsRes.success && ttsRes.audioBase64) {
          await playBase64Audio(ttsRes.audioBase64)
        }

        setCallState('idle')
        setCallCaption('Tap mic to speak')
        setCallTranscript('')
      } catch (err) {
        console.error('Voice pipeline error:', err)
        setCallCaption('Error — tap mic to try again')
        setCallState('idle')
      }
    }

    mr.start()
  }, [vehicleId, onBookingComplete, playBase64Audio])

  // ─── Voice: stop listening ─────────────────────────────────
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // Format duration
  const fmtDur = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  if (!isOpen) return null

  // ─── CALL MODE UI (corner popup, same position as chat) ────
  if (mode === 'call') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm flex flex-col rounded-2xl border border-purple-500/15 bg-black/90 backdrop-blur-2xl shadow-[0_0_80px_-15px_rgba(168,85,247,0.35)] overflow-hidden"
          style={{ animation: 'chatSlideUp .3s ease-out' }}>

          {/* Call header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-500/10 bg-purple-950/20">
            <button onClick={() => { endCall(); setMode('chat') }}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-white transition-colors">
              <HiChatAlt2 className="text-sm" /> Chat
            </button>
            <div className="text-center">
              <p className="text-[11px] font-semibold text-purple-300">AfterCare AI</p>
              <p className="text-[9px] text-gray-600">{callActive ? fmtDur(callDuration) : 'Voice Call'}</p>
            </div>
            <button onClick={() => { endCall(); onClose() }}
              className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-purple-950/30 transition-colors">
              <HiX className="text-sm" />
            </button>
          </div>

          {/* Orb area — compact */}
          <div className="flex flex-col items-center justify-center py-8 relative">
            {/* Glow background */}
            <div className={`absolute w-44 h-44 rounded-full blur-3xl transition-all duration-1000 ${
              callState === 'listening' ? 'bg-purple-500/15 scale-110' :
              callState === 'speaking' ? 'bg-purple-600/12 scale-105' :
              callState === 'thinking' ? 'bg-purple-400/10 scale-100 animate-pulse' :
              'bg-purple-900/8 scale-90'
            }`} />

            <VoiceOrb state={callActive ? callState : 'idle'} analyserRef={analyserRef} />

            {/* Status label */}
            <div className="mt-4 text-center z-10">
              <p className={`text-xs font-medium transition-all duration-300 ${
                callState === 'listening' ? 'text-purple-300' :
                callState === 'speaking' ? 'text-purple-400' :
                callState === 'thinking' ? 'text-purple-300/70' :
                'text-gray-500'
              }`}>
                {callState === 'listening' && (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Listening...
                  </span>
                )}
                {callState === 'thinking' && 'Thinking...'}
                {callState === 'speaking' && (
                  <span className="flex items-center gap-2 justify-center">
                    <HiVolumeUp className="text-sm animate-pulse" /> Speaking
                  </span>
                )}
                {callState === 'idle' && (callActive ? 'Hold mic to speak' : 'Start a call')}
              </p>

              {/* Live transcript / caption */}
              {callTranscript && (
                <p className="mt-2 text-[11px] text-gray-400 max-w-[260px] mx-auto leading-relaxed line-clamp-3">
                  {callTranscript.length > 150 ? callTranscript.slice(0, 150) + '…' : callTranscript}
                </p>
              )}
            </div>
          </div>

          {/* Call controls */}
          <div className="px-4 py-3 flex items-center justify-center gap-5 border-t border-purple-500/10">
            {!callActive ? (
              <button onClick={startCall}
                className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center shadow-[0_0_25px_-5px_rgba(34,197,94,0.5)] transition-all hover:scale-105 active:scale-95">
                <HiPhone className="text-xl text-white" />
              </button>
            ) : (
              <>
                {/* Mic button */}
                <button
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onTouchStart={startListening}
                  onTouchEnd={stopListening}
                  disabled={callState === 'thinking' || callState === 'speaking'}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    callState === 'listening'
                      ? 'bg-red-600 shadow-[0_0_25px_-5px_rgba(239,68,68,0.6)] scale-110'
                      : callState === 'thinking' || callState === 'speaking'
                      ? 'bg-purple-950/30 opacity-40 cursor-not-allowed'
                      : 'bg-purple-600/70 hover:bg-purple-500/70 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)]'
                  }`}>
                  <HiMicrophone className={`text-xl text-white ${callState === 'listening' ? 'animate-pulse' : ''}`} />
                </button>

                {/* End call button */}
                <button onClick={() => { endCall(); setMode('chat') }}
                  className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(239,68,68,0.5)] transition-all hover:scale-105 active:scale-95">
                  <HiPhone className="text-lg text-white rotate-135" />
                </button>
              </>
            )}
          </div>

          {/* Subtle hint */}
          <p className="text-center text-[9px] text-gray-700 pb-2.5">
            {callActive
              ? callState === 'listening' ? 'Release to send' : 'You can book appointments by voice too'
              : 'Press call button to connect'}
          </p>
        </div>

        <style>{`@keyframes chatSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      </div>
    )
  }

  // ─── CHAT MODE UI (original, with call toggle button) ──────
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md h-[70vh] max-h-[600px] flex flex-col rounded-2xl border border-purple-500/15 bg-black/80 backdrop-blur-2xl shadow-[0_0_60px_-15px_rgba(168,85,247,0.25)] overflow-hidden"
        style={{ animation: 'chatSlideUp .25s ease-out' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/10 bg-purple-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <HiChatAlt2 className="text-purple-400 text-sm" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">AfterCare AI</p>
              <p className="text-[10px] text-gray-500">Vehicle Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Voice call toggle */}
            <button onClick={() => setMode('call')}
              className="text-gray-500 hover:text-green-400 p-1.5 rounded-lg hover:bg-green-500/10 transition-colors"
              title="Start voice call">
              <HiPhone className="text-sm" />
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-purple-950/30 transition-colors">
              <HiX className="text-sm" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-purple-600/30 border border-purple-500/20 text-white'
                  : m.isAlert
                    ? 'bg-red-950/30 border border-red-500/20 text-gray-200'
                    : 'bg-purple-950/20 border border-purple-500/10 text-gray-300'
              }`}>
                {m.loading ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-purple-500/10 bg-purple-950/10">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about your vehicle..."
              disabled={loading}
              className="flex-1 bg-purple-950/20 border border-purple-500/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/30 focus:shadow-[0_0_12px_-4px_rgba(168,85,247,0.3)] transition-all disabled:opacity-50"
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-purple-600/60 hover:bg-purple-500/60 disabled:opacity-30 text-white transition-all hover:shadow-[0_0_15px_-5px_rgba(168,85,247,0.4)]">
              <HiPaperAirplane className="text-sm rotate-90" />
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes chatSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN PAGE                                                     */
/* ═══════════════════════════════════════════════════════════════ */

export default function VehicleDetailPage() {
  const { vehicleId } = useParams()
  const navigate = useNavigate()

  const [vehicleData, setVehicleData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInitMode, setChatInitMode] = useState('chat')
  const [telemetryExpanded, setTelemetryExpanded] = useState(false)
  const [proactiveAlert, setProactiveAlert] = useState(null)
  const [bookingInProgress, setBookingInProgress] = useState(false)
  const pollRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await pipelineAPI.getVehicle(vehicleId)
      if (res.success) {
        setVehicleData(res.data)

        // Check for proactive communication agent alerts
        const activeCase = res.data.cases?.find(c => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(c.currentState))
        if (activeCase && (activeCase.severity === 'critical' || activeCase.severity === 'high')) {
          // Build a proactive alert from the case
          const pred = res.data.predictions?.[0]
          const failureName = FAILURE_META[pred?.predictionType]?.label || pred?.predictionType || 'issue'
          setProactiveAlert(
            `Your ${VEHICLE_NAMES[vehicleId] || vehicleId} has a **${activeCase.severity}** ${failureName} detected. ` +
            `Estimated remaining useful life: **${pred?.etaDays?.toFixed(1) || 'N/A'} days**. ` +
            `Please schedule maintenance as soon as possible.`
          )
        }
      }
    } catch (err) {
      console.error('Failed to fetch vehicle:', err)
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  // Initial fetch + polling
  useEffect(() => {
    fetchData()
    pollRef.current = setInterval(fetchData, 10000)
    return () => clearInterval(pollRef.current)
  }, [fetchData])

  // Handle booking from the scheduling buttons
  const handleBookAppointment = useCallback(async (caseId, appointmentData) => {
    setBookingInProgress(true)
    try {
      const res = await schedulingAPI.approveAppointment(caseId, appointmentData)
      if (res.success) {
        // Refresh vehicle data to show confirmed state
        await fetchData()
      } else {
        console.error('Booking failed:', res.error)
        alert('Failed to book appointment: ' + (res.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Booking error:', err)
      alert('Failed to book appointment. Please try again.')
    } finally {
      setBookingInProgress(false)
    }
  }, [fetchData])

  // Handle booking completed from chatbot
  const handleChatBookingComplete = useCallback((bookingResult) => {
    console.log('Chatbot booking completed:', bookingResult)
    // Refresh vehicle data to show confirmed state
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <DotGridCanvas />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading vehicle data...</p>
        </div>
      </div>
    )
  }

  if (!vehicleData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <DotGridCanvas />
        <div className="relative z-10 text-center">
          <HiExclamationCircle className="text-4xl text-red-400 mx-auto mb-3" />
          <p className="text-lg font-semibold mb-2">Vehicle not found</p>
          <button onClick={() => navigate(-1)} className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 mx-auto">
            <HiArrowLeft /> Go back
          </button>
        </div>
      </div>
    )
  }

  const { vehicle, latestTelemetry, predictions, cases } = vehicleData
  const latestPred = predictions?.[0] || null
  const activeCase = cases?.find(c => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(c.currentState))
  const vName = VEHICLE_NAMES[vehicleId] || `${vehicle.vehicleInfo?.make} ${vehicle.vehicleInfo?.model}`.trim() || vehicleId
  const vInfo = vehicle.vehicleInfo || {}
  const owner = vehicle.owner || {}
  const usage = vehicle.usageProfile || {}

  const rulDays = latestPred?.etaDays
  const healthStatus = rulDays >= 60 ? 'healthy' : rulDays >= 21 ? 'warning' : rulDays != null ? 'critical' : 'unknown'
  const failureType = latestPred?.predictionType || 'healthy'
  const failureMeta = FAILURE_META[failureType] || FAILURE_META.healthy
  const FailureIcon = failureMeta.icon

  const healthPct = rulDays != null ? Math.min(100, Math.max(0, Math.round((rulDays / 90) * 100))) : null
  const healthColor = healthStatus === 'healthy' ? 'text-green-400' : healthStatus === 'warning' ? 'text-yellow-400' : healthStatus === 'critical' ? 'text-red-400' : 'text-gray-500'

  // Telemetry grouping
  const telemetryGroups = latestTelemetry ? [
    {
      label: 'Engine & Powertrain',
      icon: HiCog,
      items: [
        { label: 'Engine Load', value: latestTelemetry.engine_load_pct?.toFixed(1), unit: '%' },
        { label: 'RPM', value: latestTelemetry.engine_rpm?.toFixed(0), unit: '' },
        { label: 'Oil Level', value: latestTelemetry.oil_level_l?.toFixed(2), unit: 'L' },
        { label: 'Oil Pressure', value: latestTelemetry.oil_pressure_bar?.toFixed(1), unit: 'bar' },
        { label: 'Oil Temperature', value: latestTelemetry.oil_temp_c?.toFixed(1), unit: '°C' },
        { label: 'Speed', value: latestTelemetry.speed_kmh?.toFixed(1), unit: 'km/h' },
      ],
    },
    {
      label: 'DPF System',
      icon: HiFire,
      items: [
        { label: 'Soot Load', value: latestTelemetry.dpf_soot_load_pct?.toFixed(1), unit: '%' },
        { label: 'Failed Regens', value: latestTelemetry.dpf_failed_regen_count, unit: '' },
        { label: 'Pre-DPF Temp', value: latestTelemetry.dpf_pre_temp_c?.toFixed(1), unit: '°C' },
        { label: 'Post-DPF Temp', value: latestTelemetry.dpf_post_temp_c?.toFixed(1), unit: '°C' },
        { label: 'Diff Press (Up)', value: latestTelemetry.dpf_diff_pressure_upstream?.toFixed(2), unit: 'kPa' },
        { label: 'Diff Press (Down)', value: latestTelemetry.dpf_diff_pressure_downstream?.toFixed(2), unit: 'kPa' },
      ],
    },
    {
      label: 'SCR & DEF',
      icon: HiBeaker,
      items: [
        { label: 'NOx Upstream', value: latestTelemetry.scr_nox_up_ppm?.toFixed(1), unit: 'ppm' },
        { label: 'NOx Downstream', value: latestTelemetry.scr_nox_down_ppm?.toFixed(1), unit: 'ppm' },
        { label: 'SCR Conversion', value: latestTelemetry.scr_nox_conversion_pct?.toFixed(1), unit: '%' },
        { label: 'SCR Inlet Temp', value: latestTelemetry.scr_inlet_temp_c?.toFixed(1), unit: '°C' },
        { label: 'DEF Quality', value: latestTelemetry.def_quality_index?.toFixed(2), unit: '' },
        { label: 'Injector Duty', value: latestTelemetry.def_injector_duty_pct?.toFixed(1), unit: '%' },
      ],
    },
  ] : []

  // Model outputs
  const modelOutputs = latestPred?.modelOutputs || {}

  // Scheduling suggestions from active case
  const schedSuggestions = activeCase ? cases.find(c => c.caseId === activeCase.caseId) : null

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <DotGridCanvas />

      <div className="relative z-10">
        {/* ═══ Top Navigation Bar ═══ */}
        <header className="sticky top-0 z-20 bg-purple-950/15 backdrop-blur-xl border-b border-purple-500/10 shadow-[0_4px_30px_-10px_rgba(168,85,247,0.08)]">
          <div className="px-6 py-3 flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                <HiArrowLeft className="text-base" /> Back to Fleet
              </button>
              <div className="w-px h-5 bg-purple-500/10" />
              <h1 className="text-sm font-bold bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent cursor-pointer" onClick={() => navigate('/')}>AfterCare AI</h1>
            </div>
            <button onClick={() => setChatOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/50 hover:bg-purple-500/50 text-sm font-medium transition-all shadow-[0_0_20px_-5px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_-5px_rgba(168,85,247,0.4)]">
              <HiChatAlt2 className="text-base" /> Chat with AI
              {proactiveAlert && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

          {/* ═══ Hero: Vehicle Image + Quick Info ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Vehicle Image / Placeholder */}
            <Card className="lg:col-span-1 overflow-hidden relative" glow>
              <div className="aspect-[4/3] bg-purple-950/20 flex items-center justify-center relative overflow-hidden">
                {/* Placeholder — replace with real image when available */}
                <div className="flex flex-col items-center gap-3 text-gray-600">
                  <HiTruck className="text-5xl text-purple-500/20" />
                  <p className="text-[11px] uppercase tracking-wider text-gray-600">Vehicle Image</p>
                  <p className="text-[10px] text-gray-700">{vName}</p>
                </div>
                {/* Status badge overlay */}
                <div className="absolute top-3 right-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${failureMeta.bg} ${failureMeta.border} border ${failureMeta.color}`}>
                    <FailureIcon className="text-xs" /> {failureMeta.label}
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <h2 className="text-lg font-bold">{vName}</h2>
                <p className="text-xs text-gray-500">{vInfo.make} {vInfo.model} • {vInfo.year} • {vInfo.powertrain}</p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {[
                    { l: 'Owner', v: owner.name },
                    { l: 'Contact', v: owner.contact },
                    { l: 'Avg Daily KM', v: usage.avgDailyKm },
                    { l: 'Load Pattern', v: usage.loadPattern },
                  ].map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                      <p className="text-[9px] text-gray-600 uppercase tracking-wider">{item.l}</p>
                      <p className="text-[12px] font-medium capitalize mt-0.5">{item.v || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* RUL + Health Gauge */}
            <Card className="lg:col-span-1 p-5 flex flex-col items-center justify-center" glow>
              <h3 className="text-sm font-semibold mb-1">Remaining Useful Life</h3>
              <p className="text-[10px] text-gray-500 mb-5">Predicted time until maintenance needed</p>

              {rulDays != null ? (
                <RULGauge days={rulDays} />
              ) : (
                <div className="w-36 h-36 rounded-full border-4 border-purple-500/10 flex items-center justify-center">
                  <span className="text-gray-600 text-sm">No data</span>
                </div>
              )}

              <div className="mt-5 w-full space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                  <span className="text-[11px] text-gray-500">Health Status</span>
                  <span className={`text-[12px] font-bold capitalize ${healthColor}`}>{healthStatus}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                  <span className="text-[11px] text-gray-500">Overall Health</span>
                  <span className={`text-[13px] font-bold ${healthColor}`}>{healthPct != null ? `${healthPct}%` : '-'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                  <span className="text-[11px] text-gray-500">Confidence</span>
                  <span className="text-[12px] font-medium">{latestPred?.confidence ? `${(latestPred.confidence * 100).toFixed(0)}%` : '-'}</span>
                </div>
              </div>
            </Card>

            {/* ML Model Outputs */}
            <Card className="lg:col-span-1 p-5">
              <h3 className="text-sm font-semibold mb-4">ML Model Outputs</h3>
              <div className="space-y-2.5">
                {['dpf', 'scr', 'oil', 'anomaly'].map(m => {
                  const o = modelOutputs[m]
                  if (!o || o.status !== 'success') {
                    return (
                      <div key={m} className="flex items-center justify-between p-3 rounded-lg bg-purple-950/10 border border-purple-500/[0.07] opacity-50">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase">{m}</span>
                        <span className="text-[10px] text-gray-600">No data</span>
                      </div>
                    )
                  }
                  const isAnomaly = m === 'anomaly'
                  const mColor = isAnomaly
                    ? (o.is_anomaly ? 'text-red-400' : 'text-green-400')
                    : (o.rul_days >= 60 ? 'text-green-400' : o.rul_days >= 21 ? 'text-yellow-400' : 'text-red-400')

                  return (
                    <div key={m} className="p-3 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase">{m}</span>
                        {isAnomaly ? (
                          <span className={`text-[11px] font-semibold ${mColor}`}>{o.is_anomaly ? 'Anomaly' : 'Normal'}</span>
                        ) : (
                          <span className={`text-[13px] font-mono font-bold ${mColor}`}>{o.rul_days?.toFixed(1)}d</span>
                        )}
                      </div>
                      {isAnomaly ? (
                        <div className="flex items-center gap-3 text-[10px] text-gray-500">
                          <span>Score: {o.anomaly_score?.toFixed(3)}</span>
                          <span>Threshold: -0.5</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-full bg-purple-950/20 rounded-full h-1 mb-1.5">
                            <div className={`h-1 rounded-full transition-all ${o.rul_days >= 60 ? 'bg-green-500' : o.rul_days >= 21 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, (o.rul_days / 90) * 100)}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-gray-500">
                            <span>Failure Prob: {(o.failure_probability * 100).toFixed(1)}%</span>
                            <span>RUL: {o.rul_days?.toFixed(1)} days</span>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* ═══ Failure Alert Banner (if failure detected) ═══ */}
          {healthStatus !== 'healthy' && healthStatus !== 'unknown' && (
            <Card className={`p-4 border ${healthStatus === 'critical' ? 'border-red-500/20 shadow-[0_0_30px_-10px_rgba(239,68,68,0.15)]' : 'border-yellow-500/20 shadow-[0_0_30px_-10px_rgba(234,179,8,0.15)]'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${failureMeta.bg}`}>
                  <FailureIcon className={`text-xl ${failureMeta.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-bold ${healthStatus === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {healthStatus === 'critical' ? 'Critical Failure Detected' : 'Warning: Maintenance Needed'}
                  </h3>
                  <p className="text-[12px] text-gray-400 mt-1">
                    <strong>{failureMeta.label}</strong> detected with <strong>{rulDays?.toFixed(1)} days</strong> remaining useful life.
                    {healthStatus === 'critical' ? ' Immediate attention required.' : ' Schedule maintenance soon.'}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => setChatOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/50 hover:bg-purple-500/50 text-[11px] font-semibold transition-all shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)]">
                      <HiChatAlt2 className="text-xs" /> Talk to AI Assistant
                    </button>
                    {activeCase && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <HiInformationCircle /> Case {activeCase.caseId} • {activeCase.currentState}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ═══ Scheduling Options + Active Case ═══ */}
          {activeCase && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Active Case Details */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <HiExclamationCircle className="text-red-400" /> Active Maintenance Case
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeCase.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                    activeCase.severity === 'high' ? 'bg-orange-500/10 text-orange-400' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}>{activeCase.severity}</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { l: 'Case ID', v: activeCase.caseId },
                    { l: 'State', v: activeCase.currentState },
                    { l: 'Failure Type', v: activeCase.predictionType?.replace('_', ' ') },
                    { l: 'Agents Executed', v: activeCase.agentsExecuted?.join(' → ') || 'N/A' },
                    { l: 'Created', v: new Date(activeCase.createdAt).toLocaleString() },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{item.l}</span>
                      <span className="text-[12px] font-medium capitalize">{item.v || '-'}</span>
                    </div>
                  ))}
                </div>

                {/* State timeline */}
                <div className="mt-4">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Case Pipeline</p>
                  <div className="flex items-center gap-1">
                    {['RECEIVED', 'PLANNED', 'CONTACTED', 'SCHEDULED', 'CONFIRMED'].map((state, i) => {
                      const stateMap = {
                        'RECEIVED': ['RECEIVED'],
                        'PLANNED': ['ORCHESTRATING', 'PLANNED', 'PROCESSED'],
                        'CONTACTED': ['CONTACTED', 'CUSTOMER_NOTIFIED'],
                        'SCHEDULED': ['SCHEDULED', 'AWAITING_USER_APPROVAL', 'IN_SERVICE'],
                        'CONFIRMED': ['APPOINTMENT_CONFIRMED', 'COMPLETED']
                      }
                      const allStates = ['RECEIVED', 'ORCHESTRATING', 'PLANNED', 'PROCESSED', 'CONTACTED', 'CUSTOMER_NOTIFIED', 'SCHEDULED', 'AWAITING_USER_APPROVAL', 'IN_SERVICE', 'APPOINTMENT_CONFIRMED', 'COMPLETED']
                      const stateOrder = ['RECEIVED', 'PLANNED', 'CONTACTED', 'SCHEDULED', 'CONFIRMED']
                      const currentIndex = allStates.indexOf(activeCase.currentState)
                      const stateThreshold = stateOrder.indexOf(state)
                      const stateGroup = stateMap[state] || []
                      const isCurrent = stateGroup.includes(activeCase.currentState)
                      const isPast = !isCurrent && (() => {
                        // Check if current state is beyond this state group
                        const maxGroupIndex = Math.max(...stateGroup.map(s => allStates.indexOf(s)))
                        return currentIndex > maxGroupIndex
                      })()
                      return (
                        <div key={state} className="flex items-center gap-1 flex-1">
                          <div className={`w-full py-1 rounded text-center text-[8px] font-bold uppercase tracking-wider ${
                            isCurrent ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                            isPast ? 'bg-green-500/10 text-green-500/70' :
                            'bg-purple-950/10 text-gray-600'
                          }`}>{state.slice(0, 4)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>

              {/* Scheduling Suggestions */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <HiCalendar className="text-purple-400" /> Scheduling Options
                </h3>
                {(() => {
                  // Get real scheduling data from case agentResults
                  const schedAgent = activeCase.agentResults?.schedulingAgent
                  const suggestions = schedAgent?.suggestions || []
                  const isConfirmed = schedAgent?.status === 'confirmed'
                  const confirmedAppt = schedAgent?.confirmedAppointment

                  if (isConfirmed && confirmedAppt) {
                    return (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-green-950/20 border border-green-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <HiCheckCircle className="text-green-400 text-lg" />
                            <span className="text-sm font-bold text-green-400">Appointment Confirmed</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-green-950/10">
                              <span className="text-[10px] text-gray-500 uppercase">Service Center</span>
                              <span className="text-[12px] font-semibold text-white">{confirmedAppt.serviceCenter}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-green-950/10">
                              <span className="text-[10px] text-gray-500 uppercase">Date</span>
                              <span className="text-[12px] font-semibold text-white">{confirmedAppt.date ? new Date(confirmedAppt.date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</span>
                            </div>
                            {confirmedAppt.timeSlot && (
                              <div className="flex items-center justify-between p-2 rounded-lg bg-green-950/10">
                                <span className="text-[10px] text-gray-500 uppercase">Time Slot</span>
                                <span className="text-[12px] font-semibold text-white">{confirmedAppt.timeSlot}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-green-950/10">
                              <span className="text-[10px] text-gray-500 uppercase">Booked Via</span>
                              <span className="text-[12px] font-medium text-gray-400 capitalize">{confirmedAppt.confirmedBy || 'user'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (suggestions.length === 0) {
                    return (
                      <div className="text-center py-6">
                        <HiClock className="text-2xl text-gray-600 mx-auto mb-2" />
                        <p className="text-[11px] text-gray-500">No scheduling suggestions yet.</p>
                        <p className="text-[10px] text-gray-600 mt-1">Suggestions will appear once the scheduling agent processes this case.</p>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-2.5">
                      {suggestions.map((s, i) => {
                        const sc = s.serviceCenter || {}
                        const slotDate = s.slot?.date || s.date
                        const slotTime = s.slot?.timeSlot || s.timeSlot
                        const centerName = sc.name || s.centerName || 'Service Center'
                        const centerId = sc.id || s.serviceCenterId || ''
                        const distKm = s.distanceKm
                        const score = s.score || 0
                        const rating = sc.rating || null
                        const labelText = s.label === 'best_overall' ? 'Best Match' : s.label === 'alternative_center' ? 'Alternative' : s.label === 'earliest_available' ? 'Fastest' : `Option ${i+1}`

                        return (
                          <div key={i} className="p-3 rounded-xl bg-purple-950/10 border border-purple-500/[0.07] hover:border-purple-500/20 transition-all group">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mt-0.5">
                                  <HiLocationMarker className="text-purple-400 text-sm" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[12px] font-semibold">{centerName}</p>
                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 uppercase tracking-wider">{labelText}</span>
                                  </div>
                                  {sc.city && <p className="text-[10px] text-gray-500">{sc.address ? `${sc.address}, ${sc.city}` : sc.city}</p>}
                                  <div className="flex items-center gap-3 mt-1.5 text-[10px] flex-wrap">
                                    <span className="flex items-center gap-1 text-gray-400">
                                      <HiCalendar className="text-purple-400" />
                                      {slotDate ? new Date(slotDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}
                                    </span>
                                    <span className="flex items-center gap-1 text-gray-400">
                                      <HiClock className="text-purple-400" />{slotTime || 'TBD'}
                                    </span>
                                    {distKm != null && (
                                      <span className="flex items-center gap-1 text-gray-400">
                                        <HiLocationMarker className="text-purple-400" />{distKm} km
                                      </span>
                                    )}
                                    {rating && (
                                      <span className="text-gray-400">⭐ {rating}/5</span>
                                    )}
                                  </div>
                                  {s.reason && <p className="text-[9px] text-gray-600 mt-1 italic">{s.reason}</p>}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-gray-500">Match</span>
                                <p className="text-[13px] font-bold text-purple-400">{(score * 100).toFixed(0)}%</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleBookAppointment(activeCase.caseId, {
                                selectedDate: slotDate,
                                selectedTimeSlot: slotTime,
                                selectedServiceCenter: centerName,
                                serviceCenterId: centerId,
                                selectedOption: i + 1
                              })}
                              disabled={bookingInProgress}
                              className="w-full mt-2.5 py-2 rounded-lg bg-purple-600/30 hover:bg-purple-500/40 border border-purple-500/15 text-[11px] font-semibold text-purple-300 transition-all hover:shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)] disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100">
                              {bookingInProgress ? (
                                <span className="flex items-center justify-center gap-2">
                                  <div className="w-3 h-3 border border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                                  Booking...
                                </span>
                              ) : (
                                <><HiCheckCircle className="inline mr-1" /> Book Appointment</>
                              )}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </Card>
            </div>
          )}

          {/* ═══ Telemetry Readings ═══ */}
          <Card className="overflow-hidden">
            <button onClick={() => setTelemetryExpanded(!telemetryExpanded)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-purple-950/10 transition-colors">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <HiChartBar className="text-purple-400" /> Live Telemetry Readings
              </h3>
              {telemetryExpanded ? <HiChevronUp className="text-gray-500" /> : <HiChevronDown className="text-gray-500" />}
            </button>

            {telemetryExpanded && (
              <div className="px-5 pb-5 space-y-4">
                {telemetryGroups.length === 0 ? (
                  <p className="text-[11px] text-gray-600 text-center py-4">No telemetry data available yet.</p>
                ) : telemetryGroups.map((group, gi) => {
                  const GIcon = group.icon
                  return (
                    <div key={gi}>
                      <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <GIcon className="text-purple-400 text-xs" /> {group.label}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                        {group.items.map((item, ii) => (
                          <div key={ii} className="p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                            <p className="text-[9px] text-gray-600 uppercase tracking-wider">{item.label}</p>
                            <p className="text-[14px] font-bold mt-0.5">
                              {item.value ?? '-'} <span className="text-[10px] text-gray-500 font-normal">{item.unit}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* ═══ Prediction History ═══ */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <HiClock className="text-purple-400" /> Prediction History
                <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">{predictions?.length || 0}</span>
              </h3>
            </div>
            <div className="px-5 pb-4">
              {!predictions?.length ? (
                <p className="text-[11px] text-gray-600 text-center py-6">No predictions recorded yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {predictions.slice(0, 15).map((p, i) => {
                    const pMeta = FAILURE_META[p.predictionType] || FAILURE_META.healthy
                    const PIcon = pMeta.icon
                    const pColor = p.etaDays >= 60 ? 'text-green-400' : p.etaDays >= 21 ? 'text-yellow-400' : 'text-red-400'
                    return (
                      <div key={p._id || i} className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                        <div className="flex items-center gap-2.5">
                          <PIcon className={`${pMeta.color} text-sm`} />
                          <div>
                            <p className="text-[11px] font-medium capitalize">{p.predictionType?.replace('_', ' ')}</p>
                            <p className="text-[9px] text-gray-600">{new Date(p.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[13px] font-mono font-bold ${pColor}`}>{p.etaDays?.toFixed(1)}d</span>
                          <p className="text-[9px] text-gray-600">{(p.confidence * 100).toFixed(0)}% conf</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* ═══ All Cases History ═══ */}
          {cases?.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold">All Maintenance Cases</h3>
              </div>
              <div className="px-5 pb-4 space-y-1.5">
                {cases.map((c, i) => (
                  <div key={c.caseId || i} className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/[0.07]">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${c.severity === 'critical' ? 'bg-red-400' : c.severity === 'high' ? 'bg-orange-400' : 'bg-yellow-400'}`} />
                      <div>
                        <p className="text-[11px] font-medium">{c.caseId}</p>
                        <p className="text-[9px] text-gray-600 capitalize">{c.predictionType?.replace('_', ' ')} • {c.currentState}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      c.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                      c.severity === 'high' ? 'bg-orange-500/10 text-orange-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>{c.severity}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ═══ Floating Action Buttons (when chat is closed) ═══ */}
      {!chatOpen && (
        <div className="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-3">
          {/* Voice call button */}
          <button onClick={() => { setChatOpen(true); setChatInitMode('call') }}
            className="w-11 h-11 rounded-xl bg-green-600/70 hover:bg-green-500/70 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.5)] transition-all hover:scale-105">
            <HiPhone className="text-lg text-white" />
          </button>
          {/* Chat button */}
          <button onClick={() => { setChatOpen(true); setChatInitMode('chat') }}
            className="w-14 h-14 rounded-2xl bg-purple-600/70 hover:bg-purple-500/70 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)] hover:shadow-[0_0_40px_-5px_rgba(168,85,247,0.5)] transition-all hover:scale-105">
            <HiChatAlt2 className="text-2xl text-white" />
            {proactiveAlert && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[8px] font-bold animate-pulse">!</span>
            )}
          </button>
        </div>
      )}

      {/* ═══ Chatbot ═══ */}
      <Chatbot
        vehicleId={vehicleId}
        vehicleName={vName}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        proactiveAlert={proactiveAlert}
        onBookingComplete={handleChatBookingComplete}
        initMode={chatInitMode}
      />
    </div>
  )
}
