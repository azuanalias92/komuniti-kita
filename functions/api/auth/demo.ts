import { generateToken } from '../_lib/auth'
import { hashPassword } from '../_lib/password'

const DEMO_EMAIL = 'demo@komuniti.local'
const DEMO_PASSWORD = 'demo1234'
const TENANT_ID = 'default'

// ─── Fake Data ───────────────────────────────────────────────────
const MALAY_NAMES = [
  'Ahmad Faizal', 'Nurul Izzah', 'Mohd Hafiz', 'Siti Khadijah',
  'Azman Hashim', 'Farah Diana', 'Zulkifli Hassan', 'Aishah Rahman',
  'Ridzuan Ali', 'Nadia Sulaiman', 'Syafiq Abdullah', 'Hana Yusof',
  'Ismail Bakar', 'Rozita Othman', 'Firdaus Zainal', 'Maznah Ismail',
]
const CHINESE_NAMES = [
  'Tan Wei Ming', 'Lim Siew Ling', 'Wong Kok Leong', 'Lee Mei Hua',
  'Chan Kar Weng', 'Ng Pui Yee', 'Chew Hock Seng', 'Goh Bee Lian',
]
const INDIAN_NAMES = [
  'Muthu Krishnan', 'Priya Devi', 'Ravi Chandran', 'Anita Raj',
  'Saravanan Gopal', 'Kavitha Menon',
]

const CAR_BRANDS = ['Perodua', 'Proton', 'Honda', 'Toyota', 'Nissan', 'Mazda', 'BMW', 'Mercedes']
const CAR_MODELS: Record<string, string[]> = {
  Perodua: ['Myvi', 'Axia', 'Bezza', 'Alza'],
  Proton: ['Saga', 'Persona', 'X50', 'X70'],
  Honda: ['City', 'Civic', 'CR-V', 'HR-V'],
  Toyota: ['Vios', 'Hilux', 'Corolla Cross', 'Fortuner'],
  Nissan: ['Almera', 'Navara', 'X-Trail'],
  Mazda: ['CX-5', 'Mazda3', 'CX-30'],
  BMW: ['320i', 'X1', 'X5'],
  Mercedes: ['C200', 'A250', 'GLC300'],
}

const CHECKPOINTS = [
  { name: 'Guardhouse Main', lat: 3.1390, lon: 101.6869 },
  { name: 'Community Hall', lat: 3.1410, lon: 101.6880 },
  { name: 'Surau Al-Hidayah', lat: 3.1385, lon: 101.6875 },
  { name: 'Playground', lat: 3.1400, lon: 101.6890 },
  { name: 'Pool Area', lat: 3.1420, lon: 101.6870 },
  { name: 'Gym & Sports Complex', lat: 3.1405, lon: 101.6900 },
]

function randomItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randBetween(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }
function randomPlate(): string {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXY'
  return `${randomItem(letters.split(''))}${randomItem(letters.split(''))}${randomItem(letters.split(''))} ${randBetween(1000, 9999)}`
}

function randomDate(daysBack: number): string {
  const d = new Date()
  d.setDate(d.getDate() - randBetween(0, daysBack))
  d.setHours(randBetween(6, 22), randBetween(0, 59), 0, 0)
  return d.toISOString()
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

// ─── Seed Logic ──────────────────────────────────────────────────

async function seedAll(db: any) {
  // ── Ensure schemas ──
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', username TEXT, email TEXT, first_name TEXT, last_name TEXT, phone_number TEXT, status TEXT, role TEXT, password_hash TEXT, password_updated_at TEXT, created_at TEXT, updated_at TEXT, UNIQUE(tenant_id, email))`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', name TEXT NOT NULL, description TEXT, start_page TEXT, created_at TEXT, updated_at TEXT, UNIQUE(tenant_id, name))`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT, tenant_id TEXT NOT NULL DEFAULT 'default', resource TEXT, can_create INTEGER, can_read INTEGER, can_update INTEGER, can_delete INTEGER, PRIMARY KEY (role_id, resource))`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS residents (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', house_no TEXT, house_type TEXT, owners TEXT DEFAULT '[]', vehicles TEXT DEFAULT '[]', owners_json TEXT DEFAULT '[]', vehicles_json TEXT DEFAULT '[]', created_at TEXT, updated_at TEXT)`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS checkpoints (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', name TEXT NOT NULL, latitude REAL, longitude REAL, created_at TEXT, updated_at TEXT)`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS check_in_logs (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', checkpoint_id TEXT, user_id TEXT, checkpoint_name TEXT, user_name TEXT, timestamp TEXT, created_at TEXT)`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS homestay_checkins (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', homestay_id TEXT, person_in_charge TEXT, number_of_guests INTEGER, number_plates TEXT DEFAULT '[]', date_of_arrival TEXT, date_of_departure TEXT, additional_notes TEXT, submitted_at TEXT)`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS billing_settings (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', rate REAL NOT NULL, frequency TEXT NOT NULL, qr_key TEXT, start_date TEXT, updated_at TEXT)`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', house_id TEXT NOT NULL, amount REAL NOT NULL, receipt_key TEXT NOT NULL, payment_date TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT, updated_at TEXT)`).run()

  // ── Skip if already seeded ──
  const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM residents WHERE tenant_id = ?').bind(TENANT_ID).first()
  if ((countRow as any)?.cnt > 5) return // already seeded

  const now = new Date().toISOString()

  // ── Seed roles ──
  const roles = [
    { id: crypto.randomUUID(), name: 'super_admin', description: 'Full system access across all tenants', startPage: '/' },
    { id: crypto.randomUUID(), name: 'admin', description: 'Manage community data and users', startPage: '/' },
    { id: crypto.randomUUID(), name: 'owner', description: 'Resident owner with billing access', startPage: '/billing' },
    { id: crypto.randomUUID(), name: 'guard', description: 'Security guard with check-in access', startPage: '/check-in' },
  ]
  for (const r of roles) {
    await db.prepare('INSERT OR IGNORE INTO roles (id, tenant_id, name, description, start_page, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(r.id, TENANT_ID, r.name, r.description, r.startPage, now, now).run()
  }
  const roleMap: Record<string, string> = {}
  for (const r of roles) roleMap[r.name] = r.id

  // ── Seed role permissions (ACL) ──
  const resources = ['/', '/dashboard', '/directory', '/check-in', '/check-in-logs', '/checkpoints', '/homestay', '/homestay-record', '/billing', '/settings', '/users', '/roles']
  const allYes = { can_create: 1, can_read: 1, can_update: 1, can_delete: 1 }
  const readOnly = { can_create: 0, can_read: 1, can_update: 0, can_delete: 0 }
  const readWrite = { can_create: 1, can_read: 1, can_update: 1, can_delete: 0 }

  const permSets: Record<string, Record<string, { can_create: number; can_read: number; can_update: number; can_delete: number }>> = {
    super_admin: Object.fromEntries(resources.map(r => [r, allYes])),
    admin: {
      '/': allYes, '/dashboard': allYes, '/directory': allYes,
      '/check-in': allYes, '/check-in-logs': allYes, '/checkpoints': allYes,
      '/homestay': readWrite, '/homestay-record': readOnly,
      '/billing': allYes, '/settings': allYes,
      '/users': readWrite, '/roles': readOnly,
    },
    owner: {
      '/': readOnly, '/dashboard': readOnly, '/directory': readOnly,
      '/billing': readOnly, '/settings': readOnly,
    },
    guard: {
      '/': readOnly, '/check-in': readWrite, '/check-in-logs': readOnly,
      '/checkpoints': readOnly, '/directory': readOnly,
      '/homestay': readWrite, '/homestay-record': readOnly,
    },
  }

  for (const [roleName, perms] of Object.entries(permSets)) {
    const roleId = roleMap[roleName]
    if (!roleId) continue
    for (const [resource, p] of Object.entries(perms)) {
      await db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, tenant_id, resource, can_create, can_read, can_update, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(roleId, TENANT_ID, resource, p.can_create, p.can_read, p.can_update, p.can_delete).run()
    }
  }

  // ── Seed demo users ──
  const demoPwHash = await hashPassword(DEMO_PASSWORD)
  const userIds: string[] = []

  // Demo super_admin
  const demoId = crypto.randomUUID()
  await db.prepare('INSERT OR IGNORE INTO users (id, tenant_id, username, email, first_name, last_name, phone_number, status, role, password_hash, password_updated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(demoId, TENANT_ID, 'Demo Admin', DEMO_EMAIL, 'Demo', 'Admin', '012-3456789', 'active', 'super_admin', demoPwHash, now, now, now).run()

  // Extra users with various roles
  const extraUsers = [
    { username: 'admin_janet', email: 'janet@komuniti.local', firstName: 'Janet', lastName: 'Tan', phone: '012-1112222', role: 'admin' },
    { username: 'owner_rahim', email: 'rahim@komuniti.local', firstName: 'Abdul', lastName: 'Rahim', phone: '012-3334444', role: 'owner' },
    { username: 'guard_ali', email: 'ali@komuniti.local', firstName: 'Ali', lastName: 'Ahmad', phone: '012-5556666', role: 'guard' },
    { username: 'owner_fatimah', email: 'fatimah@komuniti.local', firstName: 'Siti', lastName: 'Fatimah', phone: '012-7778888', role: 'owner' },
    { username: 'owner_chong', email: 'chong@komuniti.local', firstName: 'Chong', lastName: 'Wei', phone: '012-9990000', role: 'owner' },
    { username: 'guard_kumar', email: 'kumar@komuniti.local', firstName: 'Kumar', lastName: 'Raj', phone: '012-1113333', role: 'guard' },
  ]
  for (const u of extraUsers) {
    const id = crypto.randomUUID()
    userIds.push(id)
    await db.prepare('INSERT OR IGNORE INTO users (id, tenant_id, username, email, first_name, last_name, phone_number, status, role, password_hash, password_updated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, TENANT_ID, u.username, u.email, u.firstName, u.lastName, u.phone, 'active', u.role, demoPwHash, now, now, now).run()
  }

  // ── Seed residents (houses) ──
  const allNames = [...MALAY_NAMES, ...CHINESE_NAMES, ...INDIAN_NAMES]
  const houseTypes = Array(30).fill('own')
  houseTypes[0] = 'homestay'; houseTypes[4] = 'homestay'; houseTypes[10] = 'homestay'
  houseTypes[17] = 'homestay'; houseTypes[24] = 'homestay'

  const houseIds: string[] = []
  for (let i = 0; i < 30; i++) {
    const num = Math.floor(i / 3) + 1
    const letter = String.fromCharCode(65 + (i % 3))
    const houseNo = `${num}${letter}`

    const ownerCount = randBetween(1, 2)
    const owners = []
    for (let j = 0; j < ownerCount; j++) {
      owners.push({ name: randomItem(allNames), phone: `012-${randBetween(1000000, 9999999)}` })
    }

    const vehicleCount = randBetween(0, 3)
    const vehicles = []
    for (let j = 0; j < vehicleCount; j++) {
      const brand = randomItem(CAR_BRANDS)
      vehicles.push({ brand, model: randomItem(CAR_MODELS[brand]), plate: randomPlate() })
    }

    const id = crypto.randomUUID()
    houseIds.push(id)
    const ownersJson = JSON.stringify(owners)
    const vehiclesJson = JSON.stringify(vehicles)
    await db.prepare('INSERT INTO residents (id, tenant_id, house_no, house_type, owners, vehicles, owners_json, vehicles_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, TENANT_ID, houseNo, houseTypes[i], ownersJson, vehiclesJson, ownersJson, vehiclesJson, now, now).run()
  }

  // ── Seed checkpoints ──
  const checkpointIds: string[] = []
  for (const cp of CHECKPOINTS) {
    const id = crypto.randomUUID()
    checkpointIds.push(id)
    await db.prepare('INSERT INTO checkpoints (id, tenant_id, name, latitude, longitude, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, TENANT_ID, cp.name, cp.lat, cp.lon, now, now).run()
  }

  // ── Seed check-in logs ──
  const allUserIds = [demoId, ...userIds]
  for (let day = 0; day < 30; day++) {
    const checkinsToday = randBetween(2, 12)
    for (let j = 0; j < checkinsToday; j++) {
      const d = new Date()
      d.setDate(d.getDate() - day)
      d.setHours(randBetween(6, 22), randBetween(0, 59), 0, 0)
      const userId = randomItem(allUserIds)
      const cpIdx = randBetween(0, checkpointIds.length - 1)
      await db.prepare('INSERT INTO check_in_logs (id, tenant_id, checkpoint_id, user_id, checkpoint_name, user_name, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), TENANT_ID, checkpointIds[cpIdx], userId, CHECKPOINTS[cpIdx].name, randomItem(allNames), d.toISOString(), d.toISOString()).run()
    }
  }

  // ── Seed homestay check-ins ──
  const homestayHouseIds = houseIds.filter((_, i) => houseTypes[i] === 'homestay')
  const guestNames = ['Ahmad Family', 'Tan & Friends', 'Devi Group', 'John Smith', 'Lee Wei Ping', 'Kumar Family', 'Zara Holidays', 'Al-Falah Group']
  for (let i = 0; i < 15; i++) {
    const homestayId = randomItem(homestayHouseIds)
    const arrivalDate = new Date()
    arrivalDate.setDate(arrivalDate.getDate() - randBetween(0, 30))
    const departureDate = new Date(arrivalDate)
    departureDate.setDate(departureDate.getDate() + randBetween(2, 7))

    const plates = randBetween(0, 3) > 0 ? [randomPlate(), randBetween(0, 2) > 0 ? randomPlate() : ''].filter(Boolean) : []

    await db.prepare('INSERT INTO homestay_checkins (id, tenant_id, homestay_id, person_in_charge, number_of_guests, number_plates, date_of_arrival, date_of_departure, additional_notes, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), TENANT_ID, homestayId, randomItem(guestNames), randBetween(1, 8), JSON.stringify(plates), dayAgo(randBetween(0, 30)), dayAgo(randBetween(-7, 5)), randBetween(0, 3) > 1 ? '' : 'Late check-in, please prepare keys', new Date().toISOString()).run()
  }

  // ── Seed billing settings ──
  await db.prepare('INSERT OR IGNORE INTO billing_settings (id, tenant_id, rate, frequency, start_date, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), TENANT_ID, 50.00, 'monthly', '2025-01-01', now).run()

  // ── Seed payments ──
  for (let m = 0; m < 6; m++) {
    for (const hid of houseIds) {
      if (randBetween(0, 3) > 0) { // 75% chance of payment per house per month
        const d = new Date()
        d.setMonth(d.getMonth() - m)
        d.setDate(randBetween(1, 28))
        const status = randBetween(0, 10) > 0 ? 'confirmed' : randomItem(['pending', 'confirmed'])
        await db.prepare('INSERT INTO payments (id, tenant_id, house_id, amount, receipt_key, payment_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), TENANT_ID, hid, 50.00, `receipt-${crypto.randomUUID().slice(0, 8)}`, d.toISOString().split('T')[0], status, now, now).run()
      }
    }
  }
}

// ─── Endpoint Handler ────────────────────────────────────────────

export async function onRequestPost({ env }: { env: { DB: any; JWT_SECRET?: string } }) {
  try {
    const jwtSecret = env.JWT_SECRET
    if (!jwtSecret) {
      return new Response(JSON.stringify({ error: 'JWT_SECRET not configured' }), { status: 500, headers: { 'content-type': 'application/json' } })
    }

    await seedAll(env.DB)

    // Find the demo user
    const userRow = await env.DB.prepare('SELECT id, username, email, first_name, last_name, role FROM users WHERE email = ? AND tenant_id = ?')
      .bind(DEMO_EMAIL, TENANT_ID).first() as Record<string, unknown> | null

    if (!userRow) {
      return new Response(JSON.stringify({ error: 'Demo user not found after seeding' }), { status: 500, headers: { 'content-type': 'application/json' } })
    }

    const email = String(userRow.email)
    const role = String(userRow.role || 'super_admin')
    const userId = String(userRow.id)

    const accessToken = await generateToken(
      { sub: userId, email, role: [role], tenantId: TENANT_ID, tenantName: 'Komuniti Kita' },
      jwtSecret
    )

    const user = {
      accountNo: userId,
      email,
      role: [role],
      tenantId: TENANT_ID,
      tenantName: 'Komuniti Kita',
      tenantSlug: 'komuniti-kita',
      exp: Date.now() + 24 * 60 * 60 * 1000,
      name: String(userRow.first_name || userRow.username || '').trim() || email.split('@')[0],
    }

    const headers = new Headers({ 'content-type': 'application/json' })
    headers.append('Set-Cookie', `access_token=${encodeURIComponent(JSON.stringify(accessToken))}; Path=/; Max-Age=${60 * 60 * 24 * 7}`)
    headers.append('Set-Cookie', `auth_user=${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=${60 * 60 * 24 * 7}`)

    return new Response(JSON.stringify({ ok: true, user, accessToken }), { status: 200, headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: 'demo_login_failed', detail: msg }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}
