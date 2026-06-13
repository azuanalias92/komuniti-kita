const PBKDF2_PREFIX = 'pbkdf2'
const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 16
const HASH_LENGTH = 32

function toBase64Url(bytes: Uint8Array): string {
  let str = ''
  for (const byte of bytes) str += String.fromCharCode(byte)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4)
  const normalized = padded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function deriveHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const normalizedSalt = Uint8Array.from(salt)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: normalizedSalt,
      iterations,
    },
    keyMaterial,
    HASH_LENGTH * 8
  )

  return new Uint8Array(bits)
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i]
  }
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const hash = await deriveHash(password, salt, PBKDF2_ITERATIONS)
  return [PBKDF2_PREFIX, String(PBKDF2_ITERATIONS), toBase64Url(salt), toBase64Url(hash)].join('$')
}

export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) return false

  const [prefix, iterationsText, saltText, hashText] = storedHash.split('$')
  if (prefix !== PBKDF2_PREFIX || !iterationsText || !saltText || !hashText) {
    return false
  }

  const iterations = Number(iterationsText)
  if (!Number.isFinite(iterations) || iterations <= 0) return false

  const salt = fromBase64Url(saltText)
  const expected = fromBase64Url(hashText)
  const actual = await deriveHash(password, salt, iterations)
  return timingSafeEqual(actual, expected)
}
