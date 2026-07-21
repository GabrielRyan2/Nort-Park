import { useEffect, useMemo, useState } from 'react'
import PixQRCode from './components/PixQRCode.jsx'
import {
  COURTS,
  CANCEL_REFUND_RATE,
  getSession,
  signIn,
  signUp,
  signOut,
  getSlotsForCourtAndDate,
  getMaxDuration,
  nextDays,
  toISODate,
  getReservations,
  createReservation,
  cancelReservation,
  generatePixPayload,
} from './lib/mockBackend.js'

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const money = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pad2 = (n) => String(n).padStart(2, '0')

export default function App() {
  const [session, setSession] = useState(() => getSession())
  const [screen, setScreen] = useState(session ? 'home' : 'landing')
  const [authMode, setAuthMode] = useState('login')
  const [selectedCourt, setSelectedCourt] = useState(null)
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()))
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [pendingReservation, setPendingReservation] = useState(null)
  const [reservations, setReservations] = useState([])
  const [cancelTarget, setCancelTarget] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(600)

  useEffect(() => {
    if (session) setReservations(getReservations(session.id))
  }, [session, screen])

  useEffect(() => {
    if (screen !== 'pix') return
    setSecondsLeft(600)
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [screen])

  function handleLogout() {
    signOut()
    setSession(null)
    setScreen('landing')
  }

  function goHome() {
    setScreen('home')
  }

  function openCourt(court) {
    setSelectedCourt(court)
    setSelectedSlot(null)
    setSelectedDate(toISODate(new Date()))
    setScreen('slots')
  }

  function confirmSlot(duration) {
    setSelectedSlot((prev) => ({ ...prev, duration, endHour: prev.hour + duration }))
    setScreen('checkout')
  }

  function startPixPayment() {
    const id = crypto.randomUUID()
    const total = selectedCourt.precoHora * selectedSlot.duration
    const reservation = {
      id,
      userId: session.id,
      courtId: selectedCourt.id,
      courtName: selectedCourt.nome,
      dateISO: selectedDate,
      hour: `${selectedSlot.label} às ${pad2(selectedSlot.endHour)}:00`,
      duration: selectedSlot.duration,
      preco: total,
      status: 'aguardando_pagamento',
      createdAt: new Date().toISOString(),
    }
    const payload = generatePixPayload({ valor: total, id })
    setPendingReservation({ ...reservation, pixPayload: payload })
    setScreen('pix')
  }

  function confirmPixPaid() {
    const finalReservation = { ...pendingReservation, status: 'confirmed' }
    delete finalReservation.pixPayload
    createReservation(finalReservation)
    setReservations(getReservations(session.id))
    setScreen('success')
  }

  function requestCancel(reservation) {
    setCancelTarget(reservation)
  }

  function doCancel() {
    if (!cancelTarget) return
    cancelReservation(cancelTarget.id)
    setReservations(getReservations(session.id))
    setCancelTarget(null)
  }

  return (
    <div className="app-shell">
      {screen !== 'landing' && screen !== 'auth' && (
        <TopBar session={session} screen={screen} onHome={goHome} onReservations={() => setScreen('reservations')} onLogout={handleLogout} />
      )}

      {screen === 'landing' && <Landing onStart={() => setScreen('auth')} />}

      {screen === 'auth' && (
        <AuthScreen
          mode={authMode}
          setMode={setAuthMode}
          onSuccess={(user) => {
            setSession(user)
            setScreen('home')
          }}
        />
      )}

      {screen === 'home' && <CourtsList onSelect={openCourt} />}

      {screen === 'slots' && selectedCourt && (
        <SlotPicker
          court={selectedCourt}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          onBack={goHome}
          onConfirm={confirmSlot}
        />
      )}

      {screen === 'checkout' && selectedCourt && selectedSlot && (
        <Checkout
          court={selectedCourt}
          dateISO={selectedDate}
          slot={selectedSlot}
          onBack={() => setScreen('slots')}
          onPay={startPixPayment}
        />
      )}

      {screen === 'pix' && pendingReservation && (
        <PixScreen reservation={pendingReservation} secondsLeft={secondsLeft} onConfirm={confirmPixPaid} onBack={() => setScreen('checkout')} />
      )}

      {screen === 'success' && (
        <SuccessScreen onHome={goHome} onReservations={() => setScreen('reservations')} />
      )}

      {screen === 'reservations' && (
        <Reservations reservations={reservations} onCancel={requestCancel} onHome={goHome} />
      )}

      {cancelTarget && (
        <CancelModal reservation={cancelTarget} onClose={() => setCancelTarget(null)} onConfirm={doCancel} />
      )}
    </div>
  )
}

function TopBar({ session, screen, onHome, onReservations, onLogout }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">NP</span>
        <span>
          NORT PARK
          <small>Complexo Esportivo</small>
        </span>
      </div>
      <div className="topbar-actions">
        <button className={`topbar-link ${screen === 'home' || screen === 'slots' || screen === 'checkout' || screen === 'pix' || screen === 'success' ? 'active' : ''}`} onClick={onHome}>
          Quadras
        </button>
        <button className={`topbar-link ${screen === 'reservations' ? 'active' : ''}`} onClick={onReservations}>
          Minhas Reservas
        </button>
        <span className="user-pill">
          Olá, <strong>{session?.name?.split(' ')[0]}</strong>
        </span>
        <button className="topbar-link" onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  )
}

function Landing({ onStart }) {
  return (
    <div className="landing-hero">
      <div className="landing-inner">
        <span className="landing-tag">Agendamento online</span>
        <h1>
          Reserve sua quadra no <span>Nort Park</span> em poucos cliques
        </h1>
        <p>
          Escolha a quadra, o horário e pague via Pix na hora. Simples, rápido e sem
          complicação — seu jogo garantido.
        </p>
        <button className="btn btn-primary" onClick={onStart}>
          Criar conta e agendar agora
        </button>

        <div className="landing-features">
          <div className="feature-card">
            <span className="ico">🏟️</span>
            <h4>10 quadras disponíveis</h4>
            <p>Reserve por 1 hora ou mais, direto no site.</p>
          </div>
          <div className="feature-card">
            <span className="ico">⚡</span>
            <h4>Pagamento via Pix</h4>
            <p>Confirmação instantânea, sem taxas de cartão.</p>
          </div>
          <div className="feature-card">
            <span className="ico">↩️</span>
            <h4>Cancelamento com reembolso</h4>
            <p>Cancelou? Você recebe 50% do valor pago de volta.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthScreen({ mode, setMode, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const user = mode === 'signup' ? signUp(form) : signIn(form)
      onSuccess(user)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ color: '#121212', marginBottom: 18, justifyContent: 'center' }}>
          <span className="brand-mark">NP</span>
          <span>
            NORT PARK
            <small>Complexo Esportivo</small>
          </span>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')} type="button">
            Entrar
          </button>
          <button className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')} type="button">
            Criar conta
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="field">
              <label>Nome completo</label>
              <input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Seu nome" />
            </div>
          )}
          <div className="field">
            <label>E-mail</label>
            <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="voce@email.com" />
          </div>
          {mode === 'signup' && (
            <div className="field">
              <label>Telefone</label>
              <input required value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          )}
          <div className="field">
            <label>Senha</label>
            <input required type="password" minLength={4} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            {mode === 'signup' ? 'Criar conta e continuar' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function CourtsList({ onSelect }) {
  return (
    <div className="page">
      <div className="page-header">
        <h2>Escolha sua quadra</h2>
        <p>Selecione uma quadra para ver os horários disponíveis.</p>
      </div>
      <div className="court-grid">
        {COURTS.map((court) => (
          <button key={court.id} className="court-card" onClick={() => onSelect(court)}>
            <div className="court-banner">{court.numero}</div>
            <div className="court-body">
              <h3>{court.nome}</h3>
              <div className="court-price">
                {money(court.precoHora)} <span>/ hora</span>
              </div>
              <span className="btn btn-dark btn-block">Ver horários</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function SlotPicker({ court, selectedDate, setSelectedDate, selectedSlot, setSelectedSlot, onBack, onConfirm }) {
  const days = useMemo(() => nextDays(7), [])
  const slots = useMemo(() => getSlotsForCourtAndDate(court.id, selectedDate), [court.id, selectedDate])
  const [duration, setDuration] = useState(1)

  const maxDuration = selectedSlot ? getMaxDuration(slots, selectedSlot.hour) : 0

  function pickStart(slot) {
    setSelectedSlot(slot)
    setDuration(1)
  }

  function pickDate(iso) {
    setSelectedDate(iso)
    setSelectedSlot(null)
    setDuration(1)
  }

  const total = selectedSlot ? court.precoHora * duration : 0

  return (
    <div className="page">
      <button className="breadcrumb" onClick={onBack}>
        ← Trocar quadra
      </button>
      <div className="page-header">
        <h2>{court.nome}</h2>
        <p>{money(court.precoHora)} por hora · escolha o dia, o horário de início e a duração</p>
      </div>

      <div className="date-row">
        {days.map((d) => {
          const iso = toISODate(d)
          const active = iso === selectedDate
          return (
            <button key={iso} className={`date-pill ${active ? 'active' : ''}`} onClick={() => pickDate(iso)}>
              <span className="dow">{DOW[d.getDay()]}</span>
              <span className="dnum">{d.getDate()}</span>
            </button>
          )
        })}
      </div>

      <div className="slot-legend">
        <span>
          <span className="legend-dot" style={{ background: '#fff', border: '1.5px solid #e2e2e2' }} /> Disponível
        </span>
        <span>
          <span className="legend-dot" style={{ background: '#ff6a00' }} /> Selecionado
        </span>
        <span>
          <span className="legend-dot" style={{ background: '#f4f4f4' }} /> Ocupado
        </span>
      </div>

      <div className="slot-grid">
        {slots.map((slot) => {
          const inRange = selectedSlot && slot.hour >= selectedSlot.hour && slot.hour < selectedSlot.hour + duration
          return (
            <button
              key={slot.hour}
              className={`slot-btn ${inRange ? 'selected' : ''} ${slot.taken ? 'taken' : ''}`}
              disabled={slot.taken}
              onClick={() => pickStart(slot)}
            >
              {slot.label}
            </button>
          )
        })}
      </div>

      {selectedSlot && (
        <div className="duration-picker">
          <span className="duration-label">Duração:</span>
          <div className="duration-options">
            {Array.from({ length: maxDuration }, (_, i) => i + 1).map((h) => (
              <button key={h} className={`duration-btn ${duration === h ? 'selected' : ''}`} onClick={() => setDuration(h)}>
                {h}h
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sticky-footer-bar">
        <div className="total">
          Total
          <strong>{selectedSlot ? money(total) : '—'}</strong>
        </div>
        <button className="btn btn-primary" disabled={!selectedSlot} onClick={() => onConfirm(duration)}>
          Continuar
        </button>
      </div>
    </div>
  )
}

function Checkout({ court, dateISO, slot, onBack, onPay }) {
  const date = new Date(`${dateISO}T00:00:00`)
  const dateLabel = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const total = court.precoHora * slot.duration

  return (
    <div className="page">
      <button className="breadcrumb" onClick={onBack}>
        ← Trocar horário
      </button>
      <div className="page-header">
        <h2>Confirme sua reserva</h2>
        <p>Revise os dados antes de pagar.</p>
      </div>

      <div className="summary-card">
        <div className="summary-row">
          <span className="label">Quadra</span>
          <span>{court.nome}</span>
        </div>
        <div className="summary-row">
          <span className="label">Data</span>
          <span style={{ textTransform: 'capitalize' }}>{dateLabel}</span>
        </div>
        <div className="summary-row">
          <span className="label">Horário</span>
          <span>
            {slot.label} às {pad2(slot.endHour)}:00 ({slot.duration}h)
          </span>
        </div>
        <div className="summary-row">
          <span className="label">Forma de pagamento</span>
          <span>Pix</span>
        </div>

        <div className="summary-total">
          <span className="label">Total</span>
          <strong>{money(total)}</strong>
        </div>

        <div className="policy-box">
          <strong>Política de cancelamento:</strong> em caso de cancelamento, você recebe de
          volta {Math.round(CANCEL_REFUND_RATE * 100)}% do valor pago ({money(total * CANCEL_REFUND_RATE)}).
          Os outros {Math.round((1 - CANCEL_REFUND_RATE) * 100)}% não são reembolsáveis.
        </div>

        <button className="btn btn-primary btn-block" onClick={onPay}>
          Pagar com Pix
        </button>
      </div>
    </div>
  )
}

function PixScreen({ reservation, secondsLeft, onConfirm, onBack }) {
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="page">
      <button className="breadcrumb" onClick={onBack}>
        ← Voltar
      </button>
      <div className="pix-card">
        <div className="pix-logo">
          Pagar com <b>Pix</b>
        </div>
        <div className="pix-timer">
          Expira em <strong>{mm}:{ss}</strong>
        </div>

        <PixQRCode payload={reservation.pixPayload} />

        <div className="copia-cola">
          <input readOnly value={reservation.pixPayload} onFocus={(e) => e.target.select()} />
          <button className="btn btn-dark" onClick={() => navigator.clipboard?.writeText(reservation.pixPayload)}>
            Copiar
          </button>
        </div>

        <div className="pix-status">
          <span className="pulse-dot" /> Aguardando confirmação do pagamento…
        </div>

        <button className="btn btn-primary btn-block" onClick={onConfirm}>
          Já paguei / simular confirmação
        </button>
        <p style={{ fontSize: 12, color: '#9a9a9a', marginTop: 14 }}>
          Protótipo: em produção a confirmação chega automaticamente via webhook do
          provedor de pagamento (ex.: Mercado Pago) assim que o Pix cair.
        </p>
      </div>
    </div>
  )
}

function SuccessScreen({ onHome, onReservations }) {
  return (
    <div className="page">
      <div className="success-wrap">
        <div className="success-badge">✓</div>
        <h2>Reserva confirmada!</h2>
        <p style={{ color: '#6b6b6b', marginBottom: 24 }}>
          Seu pagamento via Pix foi identificado e sua quadra está garantida. Você pode
          acompanhar os detalhes em "Minhas Reservas".
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-outline" style={{ borderColor: '#e2e2e2', color: '#121212' }} onClick={onHome}>
            Agendar outra
          </button>
          <button className="btn btn-primary" onClick={onReservations}>
            Ver minhas reservas
          </button>
        </div>
      </div>
    </div>
  )
}

function Reservations({ reservations, onCancel, onHome }) {
  return (
    <div className="page">
      <div className="page-header">
        <h2>Minhas Reservas</h2>
        <p>Acompanhe seus agendamentos e cancele se precisar.</p>
      </div>

      {reservations.length === 0 && (
        <div className="empty-state">
          <p>Você ainda não tem reservas.</p>
          <button className="btn btn-primary" onClick={onHome}>
            Agendar uma quadra
          </button>
        </div>
      )}

      {reservations.map((r) => {
        const date = new Date(`${r.dateISO}T00:00:00`)
        const dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        return (
          <div className="reservation-card" key={r.id}>
            <div className="reservation-info">
              <h4>{r.courtName}</h4>
              <p>
                {dateLabel} · {r.hour} · {money(r.preco)}
                {r.status === 'cancelled' && r.refundValue != null && (
                  <> · reembolso: {money(r.refundValue)}</>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`status-chip ${r.status === 'cancelled' ? 'status-cancelled' : 'status-confirmed'}`}>
                {r.status === 'cancelled' ? 'Cancelada' : 'Confirmada'}
              </span>
              {r.status !== 'cancelled' && (
                <button className="btn btn-outline" style={{ borderColor: '#e2e2e2', color: '#121212', padding: '8px 14px' }} onClick={() => onCancel(r)}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CancelModal({ reservation, onClose, onConfirm }) {
  const refund = Math.round(reservation.preco * CANCEL_REFUND_RATE * 100) / 100
  const retained = Math.round((reservation.preco - refund) * 100) / 100

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Cancelar reserva?</h3>
        <p>
          {reservation.courtName} · {reservation.hour}
        </p>
        <div className="refund-box">
          <div className="refund-row">
            <span>Valor pago</span>
            <span>{money(reservation.preco)}</span>
          </div>
          <div className="refund-row">
            <span>Taxa de cancelamento (50%)</span>
            <span>- {money(retained)}</span>
          </div>
          <div className="refund-row total">
            <span>Valor reembolsado</span>
            <span>{money(refund)}</span>
          </div>
        </div>
        <p style={{ fontSize: 12.5 }}>O reembolso é processado via Pix para a mesma chave utilizada no pagamento.</p>
        <div className="modal-actions">
          <button className="btn btn-outline" style={{ borderColor: '#e2e2e2', color: '#121212' }} onClick={onClose}>
            Voltar
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Confirmar cancelamento
          </button>
        </div>
      </div>
    </div>
  )
}
