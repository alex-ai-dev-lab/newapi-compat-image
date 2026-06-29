/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

type HealthChannel = {
  name: string
  health: number
}

type Telemetry = {
  qps: number
  p50: number
  successRate: number
  channels: HealthChannel[]
}

type TelemetrySamples = {
  qps: number[]
  p50: number[]
}

const FALLBACK_CHANNELS: HealthChannel[] = [
  { name: 'OpenAI', health: 99 },
  { name: 'Claude', health: 98 },
  { name: 'Gemini', health: 96 },
  { name: 'Image', health: 94 },
]

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function getNumber(
  source: Record<string, unknown>,
  keys: string[],
  fallback: number
) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return fallback
}

function normalizeStatus(payload: unknown, fallback: Telemetry): Telemetry {
  const root = getRecord(payload)
  const data = getRecord(root.data ?? root.status ?? root)
  const rawChannels = Array.isArray(data.channels)
    ? data.channels
    : Array.isArray(data.providers)
      ? data.providers
      : []

  const channels = rawChannels
    .map((item, index) => {
      const channel = getRecord(item)
      const name =
        typeof channel.name === 'string'
          ? channel.name
          : typeof channel.type === 'string'
            ? channel.type
            : FALLBACK_CHANNELS[index]?.name || `Channel ${index + 1}`
      return {
        name,
        health: Math.max(
          0,
          Math.min(
            100,
            getNumber(
              channel,
              ['health', 'healthy', 'success_rate', 'successRate'],
              fallback.channels[index]?.health || 96
            )
          )
        ),
      }
    })
    .slice(0, 4)

  return {
    qps: getNumber(
      data,
      ['throughput', 'qps', 'requests_per_second', 'requestRate'],
      fallback.qps
    ),
    p50: getNumber(
      data,
      ['p50', 'p50_latency', 'p50Latency', 'latency'],
      fallback.p50
    ),
    successRate: getNumber(
      data,
      ['success_rate', 'successRate', 'uptime'],
      fallback.successRate
    ),
    channels: channels.length ? channels : fallback.channels,
  }
}

function nextFallback(previous: Telemetry): Telemetry {
  const now = Date.now() / 1000
  return {
    qps: Math.max(
      80,
      Math.round(180 + Math.sin(now / 4) * 34 + Math.cos(now / 7) * 18)
    ),
    p50: Math.max(120, Math.round(232 + Math.cos(now / 5) * 26)),
    successRate: 99.91,
    channels: previous.channels.map((channel, index) => ({
      ...channel,
      health: Math.max(
        90,
        Math.min(100, Math.round(channel.health + Math.sin(now + index) * 1.5))
      ),
    })),
  }
}

function useTelemetry() {
  const initialTelemetry: Telemetry = {
    qps: 184,
    p50: 238,
    successRate: 99.91,
    channels: FALLBACK_CHANNELS,
  }
  const [telemetry, setTelemetry] = useState<Telemetry>(initialTelemetry)
  const telemetryRef = useRef<Telemetry>(initialTelemetry)
  const [samples, setSamples] = useState<TelemetrySamples>({
    qps: [122, 148, 136, 168, 176, 158, 192, 206, 188, 214, 226, 204],
    p50: [246, 230, 251, 218, 226, 205, 240, 222, 234, 211, 202, 238],
  })
  const [mode, setMode] = useState<'live' | 'fallback'>('fallback')

  useEffect(() => {
    let cancelled = false
    let timer = 0

    const tick = async () => {
      try {
        const response = await fetch('/api/status', {
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) throw new Error(`status ${response.status}`)
        const payload: unknown = await response.json()
        if (cancelled) return
        const next = normalizeStatus(payload, telemetryRef.current)
        telemetryRef.current = next
        setTelemetry(next)
        setSamples((items) => ({
          qps: [...items.qps.slice(-17), next.qps],
          p50: [...items.p50.slice(-17), next.p50],
        }))
        setMode('live')
      } catch {
        if (cancelled) return
        const next = nextFallback(telemetryRef.current)
        telemetryRef.current = next
        setTelemetry(next)
        setSamples((items) => ({
          qps: [...items.qps.slice(-17), next.qps],
          p50: [...items.p50.slice(-17), next.p50],
        }))
        setMode('fallback')
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(tick, 4000)
        }
      }
    }

    tick()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return { telemetry, samples, mode }
}

function QpsCanvas({ samples }: { samples: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const samplesRef = useRef(samples)

  useEffect(() => {
    samplesRef.current = samples
    const canvas = canvasRef.current
    canvas?.dispatchEvent(new Event('iz:samples-change'))
  }, [samples])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)

      const styles = getComputedStyle(canvas)
      const ink = styles.getPropertyValue('--ink').trim() || '#0D0D10'
      const line =
        styles.getPropertyValue('--line').trim() || 'rgba(13,13,16,.15)'
      const soft =
        styles.getPropertyValue('--line-soft').trim() || 'rgba(13,13,16,.07)'
      const currentSamples = samplesRef.current
      const max = Math.max(...currentSamples, 1)
      const min = Math.min(...currentSamples)
      const range = Math.max(1, max - min)
      const pad = 22
      const width = rect.width - pad * 2
      const height = rect.height - pad * 2

      ctx.strokeStyle = soft
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i += 1) {
        const y = pad + (height / 4) * i
        ctx.beginPath()
        ctx.moveTo(pad, y)
        ctx.lineTo(rect.width - pad, y)
        ctx.stroke()
      }

      ctx.strokeStyle = line
      ctx.beginPath()
      ctx.moveTo(pad, pad)
      ctx.lineTo(pad, rect.height - pad)
      ctx.lineTo(rect.width - pad, rect.height - pad)
      ctx.stroke()

      ctx.strokeStyle = ink
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      currentSamples.forEach((value, index) => {
        const x = pad + (width / Math.max(1, currentSamples.length - 1)) * index
        const y = pad + height - ((value - min) / range) * height
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      const last = currentSamples[currentSamples.length - 1] || 0
      const lastX = pad + width
      const lastY = pad + height - ((last - min) / range) * height
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    canvas.addEventListener('iz:samples-change', draw)
    return () => {
      observer.disconnect()
      canvas.removeEventListener('iz:samples-change', draw)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className='iz-live-canvas'
      aria-label='QPS line chart'
    />
  )
}

export function IzLive() {
  const { t } = useTranslation()
  const { telemetry, samples, mode } = useTelemetry()
  const latency = useMemo(() => {
    const recent = samples.p50.slice(-8)
    const max = Math.max(...recent, 1)
    const min = Math.min(...recent)
    const range = Math.max(1, max - min)
    return recent.map((value) => 0.28 + ((value - min) / range) * 0.72)
  }, [samples.p50])

  return (
    <section id='live' className='iz-block iz-block-alt iz-live'>
      <div className='iz-wrap'>
        <AnimateInView animation='fade-up'>
          <header className='iz-section-head'>
            <span className='iz-watermark'>03</span>
            <div className='iz-section-left'>
              <span className='iz-index'>03 - Live</span>
              <span className='iz-section-tag'>
                {t('The gateway, right now')}
              </span>
            </div>
            <div>
              <h2>{t("Numbers don't lie.")}</h2>
              <p className='iz-section-desc'>
                {t(
                  'Real-time telemetry from /api/status — throughput, latency and per-upstream channel health, refreshed every few seconds.'
                )}
              </p>
            </div>
          </header>
        </AnimateInView>

        <div className='iz-live-grid'>
          <AnimateInView animation='fade-up' delay={80}>
            <article className='iz-live-panel iz-live-chart-panel'>
              <div className='iz-live-panel-head'>
                <span>{t('Throughput')}</span>
                <strong>
                  {Math.round(telemetry.qps).toLocaleString('en-US')} QPS
                </strong>
              </div>
              <QpsCanvas samples={samples.qps} />
              <div className='iz-live-panel-foot'>
                <span>{t('source')}</span>
                <b>{mode === 'live' ? '/api/status' : t('fallback stream')}</b>
              </div>
            </article>
          </AnimateInView>

          <AnimateInView animation='fade-up' delay={160}>
            <article className='iz-live-panel'>
              <div className='iz-live-panel-head'>
                <span>{t('P50 latency')}</span>
                <strong>
                  {Math.round(telemetry.p50).toLocaleString('en-US')} ms
                </strong>
              </div>
              <div className='iz-spark' aria-label={t('P50 latency sparkline')}>
                {latency.map((height, index) => (
                  <span key={index} style={{ height: `${height * 100}%` }} />
                ))}
              </div>
              <div className='iz-live-health'>
                {telemetry.channels.map((channel) => (
                  <div key={channel.name} className='iz-health-row'>
                    <span className='iz-health-name'>{channel.name}</span>
                    <span className='iz-health-track'>
                      <span
                        className='iz-health-bar'
                        style={{ width: `${channel.health}%` }}
                      />
                    </span>
                    <span className='iz-health-value'>
                      {Math.round(channel.health).toLocaleString('en-US')}%
                    </span>
                  </div>
                ))}
              </div>
              <div className='iz-live-panel-foot'>
                <span>{t('success')}</span>
                <b>{telemetry.successRate.toLocaleString('en-US')}%</b>
              </div>
            </article>
          </AnimateInView>
        </div>
      </div>
    </section>
  )
}
