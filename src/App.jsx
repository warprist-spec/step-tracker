import { useEffect, useState, useRef } from 'react'
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
  const [isPulsing, setIsPulsing] = useState(false)

  const animatedSteps = useAnimatedNumber(steps)
  const progress = Math.min(steps / goal, 1)
  const percent = (steps / goal) * 100
  const circumference = 2 * Math.PI * 130
  const offset = circumference * (1 - progress)

  const km = (steps * 0.00075).toFixed(2)

  const isGoalReached = progress >= 1
  const isEmpty = steps === 0

  // Свечение кольца
  const getGlow = () => {
    if (progress >= 1) return 'drop-shadow(0 0 24px rgba(46, 204, 113, 0.6))'
    if (progress >= 0.75) return 'drop-shadow(0 0 20px rgba(46, 204, 113, 0.5))'
    if (progress >= 0.5) return 'drop-shadow(0 0 12px rgba(46, 204, 113, 0.3))'
    return 'none'
  }

  // Какой milestone достигнут
  const getMilestone = () => {
    if (percent >= 200) return 200
    if (percent >= 150) return 150
    if (percent >= 100) return 100
    return 0
  }

  const milestone = getMilestone()

  // Текст под кольцом
  const getBelowText = () => {
    if (isEmpty && !loading) return { text: 'Начни двигаться', cls: 'empty' }
    if (percent >= 200) return { text: 'Двойная цель!', cls: 'milestone-200' }
    if (percent >= 150) return { text: 'Ты сделал это!', cls: 'milestone-150' }
    if (percent >= 100) return { text: 'Цель достигнута!', cls: 'milestone-100-after' }
    return null
  }

  const below = getBelowText()

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

  // Проверка milestone
  const checkMilestones = async (currentSteps, currentGoal) => {
    if (currentGoal === 0) return

    const percentNow = (currentSteps / currentGoal) * 100
    const today = new Date().toISOString().slice(0, 10)

    const checkOne = async (threshold) => {
      if (percentNow < threshold) return false

      const flagKey = `milestone_${threshold}_${today}`
      const { value } = await Preferences.get({ key: flagKey })
      if (value === 'true') return false

      await Preferences.set({ key: flagKey, value: 'true' })
      return true
    }

    // Проверяем каждый milestone по очереди
    const is100 = await checkOne(100)
    const is150 = await checkOne(150)
    const is200 = await checkOne(200)

    if (is100 || is150 || is200) {
      // Вибрация
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy })
        await Haptics.impact({ style: ImpactStyle.Heavy })
        await Haptics.impact({ style: ImpactStyle.Heavy })
      } catch (e) {
        console.log('Вибрация не сработала:', e)
      }

      // Пульсация
      setIsPulsing(true)
      setTimeout(() => setIsPulsing(false), 2000)

      // Уведомление (только для 100%)
      if (is100) {
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
      }
    }
  }

  // Основной цикл
  useEffect(() => {
    let cancelled = false
    let interval = null
    let firstRun = true

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

              // Проверяем milestones только при первом запуске (приложение было закрыто)
              if (firstRun) {
                const percentNow = (result.steps / goal) * 100
                const today = new Date().toISOString().slice(0, 10)

                // Если milestone был достигнут, пока приложение было закрыто
                const thresholds = [100, 150, 200]
                for (const t of thresholds) {
                  if (percentNow >= t) {
                    const flagKey = `milestone_${t}_${today}`
                    const { value } = await Preferences.get({ key: flagKey })
                    if (value !== 'true') {
                      await Preferences.set({ key: flagKey, value: 'true' })
                    }
                  }
                }
              } else {
                // Обычная проверка при каждом обновлении
                await checkMilestones(result.steps, goal)
              }
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
        firstRun = false

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
        <svg
          className={`progress-ring ${isPulsing ? 'pulse' : ''}`}
          width="300"
          height="300"
        >
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
            style={{ filter: getGlow() }}
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

      {below && (
        <div className={`below-ring ${below.cls}`}>{below.text}</div>
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