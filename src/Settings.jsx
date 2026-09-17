import { useEffect, useState } from 'react'
import { registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import './Settings.css'

const StepCounterNative = registerPlugin('StepCounter')

export default function Settings({ onBack, onGoalChanged }) {
  const [goal, setGoal] = useState(10000)
  const [saved, setSaved] = useState(false)
  const [manualDate, setManualDate] = useState('')
  const [manualSteps, setManualSteps] = useState('')

  useEffect(() => {
    async function load() {
      const { value } = await Preferences.get({ key: 'goal' })
      if (value) setGoal(Number(value))
    }
    load()
  }, [])

  const saveGoal = async () => {
    await Preferences.set({ key: 'goal', value: String(goal) })
    if (onGoalChanged) onGoalChanged(goal)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const resetToday = async () => {
    try {
      await StepCounterNative.resetToday()
      alert('Сегодняшние шаги сброшены')
    } catch (e) {
      alert('Ошибка сброса: ' + e.message)
    }
  }

  const saveManualSteps = async () => {
    if (!manualDate || !manualSteps) {
      alert('Заполните обе даты и шаги')
      return
    }
    try {
      await StepCounterNative.setManualSteps({
        date: manualDate,
        steps: Number(manualSteps),
      })
      alert(`Сохранено: ${manualDate} → ${manualSteps} шагов`)
      setManualDate('')
      setManualSteps('')
    } catch (e) {
      alert('Ошибка: ' + e.message)
    }
  }

  return (
    <div className="settings">
      <header className="settings-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>Настройки</h1>
      </header>

      <section className="settings-section">
        <h2>Цель на день</h2>
        <div className="row">
          <input
            type="number"
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="input"
          />
          <span className="unit">шагов</span>
        </div>
        <div className="row presets">
          {[5000, 10000, 15000].map((preset) => (
            <button
              key={preset}
              className="preset-btn"
              onClick={() => setGoal(preset)}
            >
              {preset.toLocaleString('ru-RU')}
            </button>
          ))}
        </div>
        <button className="save-btn" onClick={saveGoal}>
          {saved ? '✓ Сохранено' : 'Сохранить цель'}
        </button>
      </section>

      <section className="settings-section">
        <h2>Сбросить сегодняшние шаги</h2>
        <button className="reset-btn" onClick={resetToday}>
          Сбросить
        </button>
      </section>

      <section className="settings-section">
        <h2>Проставить шаги на дату</h2>
        <div className="row">
          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="input"
          />
        </div>
        <div className="row">
          <input
            type="number"
            placeholder="Шаги"
            value={manualSteps}
            onChange={(e) => setManualSteps(e.target.value)}
            className="input"
          />
        </div>
        <button className="save-btn" onClick={saveManualSteps}>
          Сохранить
        </button>
      </section>
    </div>
  )
}