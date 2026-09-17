import { useEffect, useState } from 'react'
import { CapacitorPedometer } from '@capgo/capacitor-pedometer'
import { Preferences } from '@capacitor/preferences'
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
    let listener = null
    let cancelled = false

    async function init() {
      try {
        const perm = await CapacitorPedometer.requestPermissions()
        if (perm.activityRecognition !== 'granted') {
          if (!cancelled) setError('Нужно разрешение на физическую активность')
          if (!cancelled) setLoading(false)
          return
        }

        await CapacitorPedometer.startMeasurementUpdates()

        const today = new Date().toDateString()
        const { value: savedDate } = await Preferences.get({ key: 'stepDate' })
        const { value: savedBaseline } = await Preferences.get({ key: 'stepBaseline' })
        let baseline = 0

        try {
          const current = await CapacitorPedometer.getMeasurement()
          if (current && typeof current.numberOfSteps === 'number') {
            const rawSteps = current.numberOfSteps
            if (savedDate !== today) {
              baseline = rawSteps
              await Preferences.set({ key: 'stepDate', value: today })
              await Preferences.set({ key: 'stepBaseline', value: String(baseline) })
            } else {
              baseline = Number(savedBaseline || 0)
            }
          }
        } catch (e) {
          console.log('Начальное измерение не удалось:', e)
        }

        listener = await CapacitorPedometer.addListener('measurement', (data) => {
          if (!cancelled && data && typeof data.numberOfSteps === 'number') {
            const todaySteps = Math.max(0, data.numberOfSteps - baseline)
            setSteps(todaySteps)
            setLoading(false)
          }
        })

        setTimeout(() => {
          if (!cancelled) setLoading(false)
        }, 5000)
      } catch (e) {
        if (!cancelled) {
          setError('Ошибка датчика: ' + (e?.message || e))
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (listener && listener.remove) listener.remove()
    }
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>Толя, смотри какая штука! 🎉</h1>
        <p className="date">
          {new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </header>

      <div className="circle-wrapper">
        <svg className="progress-ring" width="300" height="300">
          <circle className="ring-bg" cx="150" cy="150" r="130" strokeWidth="14" fill="transparent" />
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
            style={{ stroke: ringColor, filter: `drop-shadow(0 0 12px ${ringColor}99)` }}
          />
        </svg>
        <div className="circle-content">
          <div className="steps-count">{animatedSteps.toLocaleString('ru-RU')}</div>
          <div className="steps-label">🔥 шагов</div>
        </div>
      </div>

      {loading && !error && <p className="status">Подключаюсь к датчику…</p>}
      {error && <p className="error">{error}</p>}

      <div className="km-card">
        <span className="km-value">{km}</span>
        <span className="km-label">км</span>
      </div>

      <div className="goal">Цель: {goal.toLocaleString('ru-RU')}</div>
    </div>
  )
}

export default App