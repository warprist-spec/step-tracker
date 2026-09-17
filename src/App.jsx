import { useEffect, useState } from 'react'
import { Backgroundstep } from 'capacitor-background-step'
import './App.css'

function useAnimatedNumber(target, duration = 600) {
  const [value, setValue] = useState(target)

  useEffect(() => {
    const start = value
    const diff = target - start
    if (diff === 0) return

    const startTime = performance.now()
    let raf

    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(start + diff * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return value
}

function App() {
  const [steps, setSteps] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const goal = 10000

  const animatedSteps = useAnimatedNumber(steps)
  const progress = Math.min(steps / goal, 1)
  const circumference = 2 * Math.PI * 130
  const offset = circumference * (1 - progress)

  const ringColor =
    progress >= 1 ? '#22c55e' : progress >= 0.5 ? '#facc15' : '#6366f1'

  const km = (steps * 0.00075).toFixed(2)

  useEffect(() => {
    let cancelled = false
    let interval = null

    async function init() {
      try {
        const permission = await Backgroundstep.checkAndRequestPermission()
        if (!permission.granted) {
          if (!cancelled) {
            setError('Нужно разрешение на физическую активность')
            setLoading(false)
          }
          return
        }

        await Backgroundstep.serviceStart()

        const fetchSteps = async () => {
          try {
            const result = await Backgroundstep.getToday()
            if (!cancelled && result && typeof result.steps === 'number') {
              setSteps(result.steps)
              setLoading(false)
            }
          } catch (e) {
            console.log('Ошибка получения шагов:', e)
          }
        }

        fetchSteps()
        interval = setInterval(fetchSteps, 5000)
      } catch (e) {
        if (!cancelled) {
          setError('Ошибка сервиса: ' + (e?.message || e))
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>Шагомер! 🎉</h1>
        <p className="date">
          {new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </header>

      <div className="circle-wrapper">
        <svg className="progress-ring" width="300" height="300">
          <circle
            className="ring-bg"
            cx="150"
            cy="150"
            r="130"
            strokeWidth="14"
            fill="transparent"
          />
          <circle
            className="ring-progress"
            cx="150"
            cy="150"
            r="130"
            strokeWidth="14"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              stroke: ringColor,
              filter: `drop-shadow(0 0 12px ${ringColor}99)`,
            }}
          />
        </svg>
        <div className="circle-content">
          <div className="steps-count">
            {animatedSteps.toLocaleString('ru-RU')}
          </div>
          <div className="steps-label">🔥 шагов</div>
        </div>
      </div>

      {loading && !error && (
        <p className="status">Подключаюсь к сервису…</p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="km-card">
        <span className="km-value">{km}</span>
        <span className="km-label">км</span>
      </div>

      <div className="goal">
        Цель: {goal.toLocaleString('ru-RU')}
      </div>
    </div>
  )
}

export default App