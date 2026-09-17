import { useEffect, useState } from 'react'
import { registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import Settings from './Settings'
import History from './History'
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
  const [view, setView] = useState('main')
  const [goal, setGoal] = useState(10000)

  const animatedSteps = useAnimatedNumber(steps)
  const progress = Math.min(steps / goal, 1)
  const circumference = 2 * Math.PI * 130
  const offset = circumference * (1 - progress)

  const km = (steps * 0.00075).toFixed(2)

  const isGoalReached = progress >= 1
  const isEmpty = steps === 0

  // Загрузка цели
  useEffect(() => {
    async function loadGoal() {
      const { value } = await Preferences.get({ key: 'goal' })
      if (value) setGoal(Number(value))
    }
    loadGoal()
  }, [])

  // Разрешение на уведомления
  useEffect(() => {
    async function requestNotifPermission() {
      try {
        const perm = await LocalNotifications.checkPermissions()
        if (perm.display !== 'granted') {
          await LocalNotifications.requestPermissions()
        }
      } catch (e) {
        console.log('Ошибка разрешения уведомлений:', e)
      }
    }
    requestNotifPermission()
  }, [])

  const checkGoalReached = async (currentSteps, currentGoal) => {
    if (currentSteps < currentGoal) return

    const today = new Date().toISOString().slice(0, 10)
    const flagKey = 'notified_' + today

    const { value: notified } = await Preferences.get({ key: flagKey })
    if (notified === 'true') return

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy })
      await Haptics.impact({ style: ImpactStyle.Heavy })
      await Haptics.impact({ style: ImpactStyle.Heavy })
    } catch (e) {
      console.log('Вибрация не сработала:', e)
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: '🎉 Цель достигнута!',
            body: `Ты прошёл ${currentSteps.toLocaleString('ru-RU')} шагов!`,
            id: 1,
            schedule: { at: new Date(Date.now() + 100) },
          },
        ],
      })
    } catch (e) {
      console.log('Уведомление не отправилось:', e)
    }

    await Preferences.set({ key: flagKey, value: 'true' })
  }

  // Основной цикл
  useEffect(() => {
    let cancelled = false
    let interval = null

    async function init() {
      try {
        try {
          await StepCounterNative.startService()
        } catch (e) {
          console.log('Ошибка запуска сервиса:', e)
        }

        const fetchSteps = async () => {
          try {
            const result = await StepCounterNative.getTodaySteps()
            if (!cancelled && result && typeof result.steps === 'number') {
              setSteps(result.steps)
              setLoading(false)
              await checkGoalReached(result.steps, goal)
            }
          } catch (e) {
            if (!cancelled) {
              setError('Ошибка: ' + (e?.message || e))
              setLoading(false)
            }
          }
        }

        const fetchHistory = async () => {
          try {
            const result = await StepCounterNative.getHistory({ days: 7 })
            if (!cancelled && result && result.history) {
              const days = []
              for (let i = 6; i >= 0; i--) {
                const d = new Date()
                d.setDate(d.getDate() - i)
                const key = d.toISOString().slice(0, 10)
                days.push({
                  date: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
                  steps: Number(result.history[key] || 0),
                  isToday: i === 0,
                })
              }
              setHistory(days)
            }
          } catch (e) {
            console.log('История не загрузилась:', e)
          }
        }

        await fetchSteps()
        await fetchHistory()

        interval = setInterval(async () => {
          await fetchSteps()
          await fetchHistory()
        }, 5000)

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
  }, [goal])

  const maxHistorySteps = Math.max(...history.map((d) => d.steps), goal, 1)

  if (view === 'settings') {
    return (
      <Settings
        onBack={() => setView('main')}
        onGoalChanged={(newGoal) => setGoal(newGoal)}
      />
    )
  }

  if (view === 'history') {
    return <History onBack={() => setView('main')} />
  }

  return (
    <div
      className="app"
      style={{ background: isGoalReached ? '#0d2818' : '#0a0f0a' }}
    >
      <div className="top-buttons">
        <button className="settings-btn" onClick={() => setView('history')}>
          📊
        </button>
        <button className="settings-btn" onClick={() => setView('settings')}>
          ⚙️
        </button>
      </div>

      <header className="header">
        <h1>Сегодня</h1>
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
            strokeWidth="16"
            fill="transparent"
          />
          <circle
            className="ring-progress"
            cx="150"
            cy="150"
            r="130"
            strokeWidth="16"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="circle-content">
          <div className={`steps-count ${isEmpty ? 'empty' : ''}`}>
            {animatedSteps.toLocaleString('ru-RU')}
          </div>
          <div className={`steps-label ${isEmpty ? 'empty' : ''}`}>
            шагов
          </div>
        </div>
      </div>

      {isEmpty && !loading && (
        <div className="empty-hint">Начни двигаться</div>
      )}

      {loading && !error && (
        <p className="status">Подключаюсь к сервису…</p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="km-card">
        <span className="km-value">{km}</span>
        <span className="km-label">км</span>
      </div>

      <div className="goal">
        Цель: {goal.toLocaleString('ru-RU')} шагов
      </div>

      <div className="history">
        {history.map((day, i) => {
          const isEmptyBar = day.steps === 0
          const barColor = day.isToday ? '#2ecc71' : '#6c5ce7'
          return (
            <div key={i} className="history-bar-wrapper">
              <div
                className={`history-bar ${isEmptyBar ? 'empty' : ''}`}
                style={{
                  height: isEmptyBar
                    ? '2px'
                    : `${Math.max(2, (day.steps / maxHistorySteps) * 100)}%`,
                  background: isEmptyBar ? '#2a2a32' : barColor,
                }}
              />
              <span className="history-label">{day.date}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default App