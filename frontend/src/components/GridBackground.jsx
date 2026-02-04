import { useEffect, useRef } from 'react'

function GridBackground({ children }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationFrameId
    let time = 0

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const gridSize = 40
    let cols, rows
    let activeSquares = [] // Squares currently pulsating
    let lastSpawnTime = 0
    const spawnInterval = 600 // Spawn new pulsating square every 180 frames (very slow)

    const initializeGrid = () => {
      cols = Math.ceil(canvas.width / gridSize)
      rows = Math.ceil(canvas.height / gridSize)
      activeSquares = []

      // Start with multiple random squares
      const initialSquares = Math.floor((cols * rows) * 0.02) // 2% of grid
      for (let i = 0; i < initialSquares; i++) {
        spawnNewSquare(Math.random()) // Start at random points in their lifecycle
      }
    }

    const spawnNewSquare = (initialLife = 0) => {
      activeSquares.push({
        col: Math.floor(Math.random() * cols),
        row: Math.floor(Math.random() * rows),
        life: initialLife, // 0 to 1, represents the pulse lifecycle
        maxOpacity: Math.random() * 0.15 + 0.08, // 0.08 to 0.23
        speed: Math.random() * 0.002 + 0.003, // 0.003 to 0.005 per frame (very slow)
      })
    }

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw grid lines with more visibility
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 1

      // Vertical lines
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath()
        ctx.moveTo(i * gridSize, 0)
        ctx.lineTo(i * gridSize, canvas.height)
        ctx.stroke()
      }

      // Horizontal lines
      for (let i = 0; i <= rows; i++) {
        ctx.beginPath()
        ctx.moveTo(0, i * gridSize)
        ctx.lineTo(canvas.width, i * gridSize)
        ctx.stroke()
      }

      // Update and draw active squares
      activeSquares = activeSquares.filter(square => {
        square.life += square.speed

        // If square completed its lifecycle, remove it
        if (square.life >= 1) {
          return false
        }

        // Calculate opacity using a fade in-out curve
        let opacity
        if (square.life < 0.5) {
          // Fade in
          opacity = (square.life / 0.5) * square.maxOpacity
        } else {
          // Fade out
          opacity = ((1 - square.life) / 0.5) * square.maxOpacity
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.fillRect(square.col * gridSize, square.row * gridSize, gridSize, gridSize)

        return true
      })
    }

    const animate = () => {
      time++

      // Spawn new squares periodically (but keep multiple active)
      if (time - lastSpawnTime > spawnInterval) {
        // Spawn 1-3 new squares at once
        const numToSpawn = Math.floor(Math.random() * 3) + 1
        for (let i = 0; i < numToSpawn; i++) {
          spawnNewSquare()
        }
        lastSpawnTime = time
      }

      drawGrid()
      animationFrameId = requestAnimationFrame(animate)
    }

    updateCanvasSize()
    initializeGrid()
    animate()

    const handleResize = () => {
      updateCanvasSize()
      initializeGrid()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-black">
      <div className="fixed inset-0 pointer-events-none z-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
        />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

export default GridBackground
