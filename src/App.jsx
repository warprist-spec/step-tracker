import { useEffect, useState } from 'react'
import { registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import './App.css'

const StepCounterNative = registerPlugin('StepCounter')

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
  const [history, setHistory] = useState([])
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
        // 1. Запускаем фоновый сервис
        try {
          await StepCounterNative.startService()
          console.log('Фоновый сервис запущен')
        } catch (e) {
          console.log('Ошибка запуска сервиса:', e)
        }

        // 2. Функция чтения шагов
        const fetchSteps = async () => {
          try {
            const result = await StepCounterNative.getTodaySteps()
            if (!cancelled && result && typeof result.steps === 'number') {
              setSteps(result.steps)
              setLoading(false)

              // Сохраняем в историю
              const todayKey = new Date().toISOString().slice(0, 10)
              await Preferences.set({
                key: 'history_' + todayKey,
                value: String(result.steps),
              })
            }
          } catch (e) {
            if (!cancelled) {
              setError('Ошибка: ' + (e?.message || e))
              setLoading(false)
            }
          }
        }

        // Первый запрос
        await fetchSteps()

        // 3. Опрашиваем каждые 5 секунд
        interval = setInterval(fetchSteps, 5000)

        // Убираем статус загрузки через 5 секунд, даже если данных нет
        setTimeout(() => {
          if (!cancelled) setLoading(false)
        }, 5000)
      } catch (e) {
        if (!cancelled) {
          setError('Ошибка: ' + (e?.message || e))
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

  // История за 7 дней
  useEffect(() => {
    async function loadHistory() {
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = 'history_' + d.toISOString().slice(0, 10)
        const { value } = await Preferences.get({ key })
        days.push({
          date: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
          steps: Number(value || 0),
        })
      }
      setHistory(days)
    }
    loadHistory()
  }, [steps])

  const maxHistorySteps = Math.max(...history.map((d) => d.steps), goal, 1)

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

      <div className="history">
        {history.map((day, i) => (
          <div key={i} className="history-bar-wrapper">
            <div
              className="history-bar"
              style={{
                height: `${Math.max(2, (day.steps / maxHistorySteps) * 100)}%`,
              }}
            />
            <span className="history-label">{day.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App