// Camada de dados de DEMONSTRAÇÃO. Em produção isto vira:
//  - Auth: Supabase Auth (ou outro provedor) em vez de localStorage.
//  - Reservas/quadras: tabelas no banco (Postgres/Supabase) com RLS.
//  - Pix: uma Edge Function que chama a API de um PSP (Mercado Pago, Efí,
//    PagSeguro...) para gerar o QR Code real e receber o webhook de confirmação.

const USERS_KEY = 'nortpark_users'
const SESSION_KEY = 'nortpark_session'
const RESERVATIONS_KEY = 'nortpark_reservations'

export const COURTS = Array.from({ length: 10 }, (_, i) => ({
  id: `quadra-${i + 1}`,
  numero: i + 1,
  nome: `Quadra ${i + 1}`,
  precoHora: 60,
}))

// Máximo de horas seguidas que dá pra reservar de uma vez.
export const MAX_DURATION_HOURS = 6

export const CANCEL_REFUND_RATE = 0.5 // política: 50% de volta em caso de cancelamento

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ---------- Auth (mock) ----------
export function signUp({ name, email, phone, password }) {
  const users = readJSON(USERS_KEY, [])
  if (users.some((u) => u.email === email)) {
    throw new Error('Já existe uma conta com esse e-mail.')
  }
  const user = { id: crypto.randomUUID(), name, email, phone, password }
  users.push(user)
  writeJSON(USERS_KEY, users)
  writeJSON(SESSION_KEY, { id: user.id, name: user.name, email: user.email })
  return { id: user.id, name: user.name, email: user.email }
}

export function signIn({ email, password }) {
  const users = readJSON(USERS_KEY, [])
  const user = users.find((u) => u.email === email && u.password === password)
  if (!user) throw new Error('E-mail ou senha incorretos.')
  writeJSON(SESSION_KEY, { id: user.id, name: user.name, email: user.email })
  return { id: user.id, name: user.name, email: user.email }
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY)
}

export function getSession() {
  return readJSON(SESSION_KEY, null)
}

// ---------- Horários ----------
const START_HOUR = 7
const END_HOUR = 23

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function getSlotsForCourtAndDate(courtId, dateISO) {
  const slots = []
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    const label = `${String(hour).padStart(2, '0')}:00`
    const seed = hashString(`${courtId}-${dateISO}-${hour}`)
    const taken = seed % 100 < 28 // ~28% dos horários já ocupados, de forma determinística
    slots.push({ hour, label, taken })
  }
  return slots
}

export function getMaxDuration(slots, startHour) {
  const startIdx = slots.findIndex((s) => s.hour === startHour)
  if (startIdx === -1) return 0
  let count = 0
  for (let i = startIdx; i < slots.length && count < MAX_DURATION_HOURS; i++) {
    if (slots[i].taken) break
    count++
  }
  return count
}

export function nextDays(count = 7) {
  const days = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d)
  }
  return days
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10)
}

// ---------- Reservas ----------
export function getReservations(userId) {
  const all = readJSON(RESERVATIONS_KEY, [])
  return all.filter((r) => r.userId === userId).sort((a, b) => (a.dateISO + a.hour < b.dateISO + b.hour ? 1 : -1))
}

export function createReservation(reservation) {
  const all = readJSON(RESERVATIONS_KEY, [])
  all.push(reservation)
  writeJSON(RESERVATIONS_KEY, all)
  return reservation
}

export function cancelReservation(id) {
  const all = readJSON(RESERVATIONS_KEY, [])
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return null
  const refundValue = Math.round(all[idx].preco * CANCEL_REFUND_RATE * 100) / 100
  all[idx] = { ...all[idx], status: 'cancelled', refundValue, cancelledAt: new Date().toISOString() }
  writeJSON(RESERVATIONS_KEY, all)
  return all[idx]
}

// ---------- Pix (simulado) ----------
// Gera um payload no formato "copia e cola" só para exibição visual.
// Um PSP real (Mercado Pago/Efí/PagSeguro) devolveria o payload EMV oficial.
export function generatePixPayload({ valor, id }) {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `00020126580014BR.GOV.BCB.PIX0136${id}${random}5204000053039865406${valor.toFixed(2)}5802BR5913NORT PARK LTDA6009SAOPAULO62070503***6304${random.slice(0, 4)}`
}
