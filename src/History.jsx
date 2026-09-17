import { useEffect, useState } from 'react'
import { registerPlugin } from '@capacitor/core'
import './History.css'

const StepCounterNative = registerPlugin('StepCounter')

export default function History({ onBack }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const result = await StepCounterNative.getHistory({ days: 30 })
        if (result && result.history) {
          const days = []
          for (let i = 29; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const key = d.toISOString().slice(0, 10)
            days.push({
              date: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
              shortDate: d.toLocaleDateString('ru-RU', { day: 'numeric' }),
              steps: Number(result.history[key] || 0),
            })
          }
          setHistory(days)
        }
      } catch (e) {
        console.log('Ошибка:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalSteps = history.reduce((sum, d) => sum + d.steps, 0)
  const avgSteps = history.length ? Math.round(totalSteps / history.length) : 0
  const maxSteps = Math.max(...history.map((d) => d.steps), 1)

  return (
    <div className="history-screen">
      <header className="history-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>История</h1>
      </header>

      <div className="history-summary">
        <div className="summary-card">
          <div className="summary-value">{totalSteps.toLocaleString('ru-RU')}</div>
          <div className="summary-label">шагов за 30 дней</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{avgSteps.toLocaleString('ru-RU')}</div>
          <div className="summary-label">в среднем в день</div>
        </div>
      </div>

      {loading ? (
        <p className="status">Загружаю историю…</p>
      ) : (
        <div className="history-chart">
          <div className="chart-bars">
            {history.map((day, i) => (
              <div key={i} className="chart-bar-wrapper">
                <div
                  className="chart-bar"
                  style={{
                    height: `${Math.max(2, (day.steps / maxSteps) * 100)}%`,
                  }}
                  title={`${day.date}: ${day.steps} шагов`}
                />
                <span className="chart-label">{day.shortDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}