import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const PRESETS = [
  { label: '5 min', seconds: 5 * 60 },
  { label: '15 min', seconds: 15 * 60 },
  { label: '25 min', seconds: 25 * 60 },
  { label: '45 min', seconds: 45 * 60 },
]

type Phase = 'idle' | 'running' | 'paused' | 'done'

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function App() {
  const [duration, setDuration] = useState(PRESETS[2].seconds)
  const [remaining, setRemaining] = useState(PRESETS[2].seconds)
  const [phase, setPhase] = useState<Phase>('idle')
  const intervalRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const start = useCallback(() => {
    if (phase === 'running') return
    setPhase('running')
    clearTimer()
    intervalRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer()
          setPhase('done')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [phase, clearTimer])

  const pause = useCallback(() => {
    clearTimer()
    setPhase('paused')
  }, [clearTimer])

  const reset = useCallback(() => {
    clearTimer()
    setRemaining(duration)
    setPhase('idle')
  }, [clearTimer, duration])

  const selectPreset = useCallback(
    (seconds: number) => {
      clearTimer()
      setDuration(seconds)
      setRemaining(seconds)
      setPhase('idle')
    },
    [clearTimer],
  )

  const progress = useMemo(
    () => (duration === 0 ? 0 : 1 - remaining / duration),
    [duration, remaining],
  )

  const radius = 130
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__logo" aria-hidden="true">
          <PowerIcon />
        </div>
        <h1 className="app__title">Turn Off</h1>
        <p className="app__subtitle">Step away. Reset your focus. Unplug.</p>
      </header>

      <section className="timer" aria-live="polite">
        <svg className="timer__ring" viewBox="0 0 300 300" role="img" aria-label="Focus timer">
          <circle className="timer__track" cx="150" cy="150" r={radius} />
          <circle
            className={`timer__progress ${phase === 'done' ? 'timer__progress--done' : ''}`}
            cx="150"
            cy="150"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="timer__center">
          <span className="timer__time" data-testid="time-display">
            {formatTime(remaining)}
          </span>
          <span className="timer__status" data-testid="status">
            {phase === 'done'
              ? "You're turned off"
              : phase === 'running'
                ? 'Focusing…'
                : phase === 'paused'
                  ? 'Paused'
                  : 'Ready'}
          </span>
        </div>
      </section>

      <div className="presets" role="group" aria-label="Duration presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            type="button"
            className={`preset ${duration === preset.seconds ? 'preset--active' : ''}`}
            onClick={() => selectPreset(preset.seconds)}
            disabled={phase === 'running'}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="controls">
        {phase !== 'running' ? (
          <button
            type="button"
            className="control control--primary"
            onClick={start}
            disabled={remaining === 0}
          >
            {phase === 'paused' ? 'Resume' : 'Start'}
          </button>
        ) : (
          <button type="button" className="control control--primary" onClick={pause}>
            Pause
          </button>
        )}
        <button type="button" className="control" onClick={reset}>
          Reset
        </button>
      </div>
    </main>
  )
}

function PowerIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  )
}
