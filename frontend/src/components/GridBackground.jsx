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
    const spawnInterval = 200 // Spawn new pulsating squares more frequently (every 2 seconds)

    const initializeGrid = () => {
      cols = Math.ceil(canvas.width / gridSize)
      rows = Math.ceil(canvas.height / gridSize)
      activeSquares = []

      // Start with more random squares for more activity
      const initialSquares = Math.floor((cols * rows) * 0.08) // 8% of grid
      for (let i = 0; i < initialSquares; i++) {
        spawnNewSquare(Math.random()) // Start at random points in their lifecycle
      }
    }

    const spawnNewSquare = (initialLife = 0) => {
      const colorType = Math.random()
      let color
      if (colorType < 0.7) {
        // 70% white
        color = { r: 255, g: 255, b: 255 }
      } else if (colorType < 0.9) {
        // 20% purple
        color = { r: 168, g: 85, b: 247 } // purple-500
      } else {
        // 10% light purple
        color = { r: 192, g: 132, b: 252 } // purple-400
      }

      activeSquares.push({
        col: Math.floor(Math.random() * cols),
        row: Math.floor(Math.random() * rows),
        life: initialLife, // 0 to 1, represents the pulse lifecycle
        maxOpacity: Math.random() * 0.25 + 0.12, // 0.12 to 0.37 (increased for more visibility)
        speed: Math.random() * 0.004 + 0.002, // 0.002 to 0.006 per frame (slower for gradual fade)
        color: color
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

        // Calculate opacity using a smooth fade in-out curve
        let opacity
        if (square.life < 0.5) {
          // Fade in with ease-out
          const t = square.life / 0.5
          opacity = (1 - Math.cos(t * Math.PI)) / 2 * square.maxOpacity
        } else {
          // Fade out with ease-in
          const t = (square.life - 0.5) / 0.5
          opacity = (1 + Math.cos(t * Math.PI)) / 2 * square.maxOpacity
        }

        ctx.fillStyle = `rgba(${square.color.r}, ${square.color.g}, ${square.color.b}, ${opacity})`
        ctx.fillRect(square.col * gridSize, square.row * gridSize, gridSize, gridSize)

        return true
      })
    }

    const animate = () => {
      time++

      // Spawn new squares more frequently with more variety
      if (time - lastSpawnTime > spawnInterval) {
        // Spawn 3-8 new squares at once for more fluid activity
        const numToSpawn = Math.floor(Math.random() * 5) + 2
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
