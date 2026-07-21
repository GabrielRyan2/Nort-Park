import { useEffect, useRef } from 'react'

// Renderiza um padrão determinístico a partir do payload, só para fins visuais
// no protótipo. Em produção, troque por um QR real gerado a partir do payload
// EMV retornado pelo PSP (ex.: biblioteca "qrcode" ou o próprio PNG do gateway).
export default function PixQRCode({ payload, size = 200 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const grid = 21
    canvas.width = grid
    canvas.height = grid
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, grid, grid)
    ctx.fillStyle = '#121212'

    let seed = 0
    for (let i = 0; i < payload.length; i++) seed = (seed * 31 + payload.charCodeAt(i)) >>> 0
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }

    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        if (rand() > 0.55) ctx.fillRect(x, y, 1, 1)
      }
    }

    const drawFinder = (ox, oy) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(ox, oy, 7, 7)
      ctx.fillStyle = '#121212'
      ctx.fillRect(ox, oy, 7, 1)
      ctx.fillRect(ox, oy + 6, 7, 1)
      ctx.fillRect(ox, oy, 1, 7)
      ctx.fillRect(ox + 6, oy, 1, 7)
      ctx.fillRect(ox + 2, oy + 2, 3, 3)
    }
    drawFinder(0, 0)
    drawFinder(grid - 7, 0)
    drawFinder(0, grid - 7)
  }, [payload])

  return (
    <div className="qr-box" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
