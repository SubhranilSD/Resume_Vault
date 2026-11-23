// Shared helpers for turning raw ResumeDataset rows into clean, display-ready values.

export const FIRST_NAMES = [
  'Aarav', 'Sophia', 'Liam', 'Olivia', 'Noah', 'Emma', 'Ethan', 'Ava', 'Lucas', 'Mia',
  'Mason', 'Isabella', 'Logan', 'Amelia', 'James', 'Harper', 'Benjamin', 'Evelyn', 'Elijah', 'Abigail',
  'Rohan', 'Priya', 'Arjun', 'Ananya', 'Kabir', 'Diya', 'Vikram', 'Neha', 'Siddharth', 'Kavya',
  'Daniel', 'Chloe', 'Matthew', 'Grace', 'Henry', 'Zoe', 'Sebastian', 'Hannah', 'Jack', 'Aria',
  'Ishaan', 'Meera', 'Tanvi', 'Aditya', 'Nikhil', 'Sara', 'Omar', 'Layla', 'Mateo', 'Lucia',
  'Kenji', 'Yuna', 'Felix', 'Clara', 'Hugo', 'Elena', 'Theo', 'Nora', 'Ravi', 'Asha'
]
export const LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Mehta', 'Kapoor', 'Nair', 'Rao', 'Gupta', 'Malhotra', 'Deshmukh',
  'Chen', 'Wang', 'Kim', 'Park', 'Tanaka', 'Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Hernandez',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor',
  "O'Connor", 'Meyer', 'Rossi', 'Dubois', 'Silva', 'Kowalski', 'Novak', 'Jensen', 'Lindqvist', 'Sato',
  'Iyer', 'Banerjee', 'Chatterjee', 'Reddy', 'Joshi', 'Khan', 'Haddad', 'Okafor', 'Mensah', 'Costa',
  'Moreau', 'Fischer', 'Weber', 'Nakamura', 'Ito', 'Ahmed', 'Bose', 'Pillai', 'Saxena', 'Thomas'
]

function mix(n, salt) {
  let x = (Number(n) ^ salt) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}

export function makeName(id) {
  const first = FIRST_NAMES[mix(id, 17) % FIRST_NAMES.length]
  const last = LAST_NAMES[mix(id, 91) % LAST_NAMES.length]
  const middle = String.fromCharCode(65 + (mix(id, 53) % 26))
  return `${first} ${middle}. ${last}`
}

const ACRONYMS = {
  hr: 'HR', it: 'IT', vp: 'VP', avp: 'AVP', svp: 'SVP', evp: 'EVP', ceo: 'CEO', cfo: 'CFO', cto: 'CTO',
  coo: 'COO', cio: 'CIO', qa: 'QA', ui: 'UI', ux: 'UX', sap: 'SAP', bpo: 'BPO', pr: 'PR', rn: 'RN',
  cpa: 'CPA', crm: 'CRM', erp: 'ERP', sql: 'SQL', aws: 'AWS', ii: 'II', iii: 'III', iv: 'IV', us: 'US', usa: 'USA'
}

export function titleCase(str) {
  return String(str)
    .toLowerCase()
    .replace(/[a-z0-9]+/g, (w) => ACRONYMS[w] || w.charAt(0).toUpperCase() + w.slice(1))
    .trim()
}

export function prettyCategory(cat) {
  return titleCase(String(cat || 'General').replace(/[-_]+/g, ' '))
}

export function sourceLabel(cat) {
  return `Dataset · ${prettyCategory(cat)}`
}

const STOP_TOKENS = [
  'skills', 'skill highlights', 'links', 'professional summary', 'summary', 'executive profile', 'profile',
  'career overview', 'career focus', 'objective', 'highlights', 'experience', 'qualifications',
  'accomplishments', 'core competencies', 'overview', 'education', 'contact', 'email', 'phone', 'www', 'http'
]

export function cleanTitle(raw, category) {
  let t = String(raw || '').replace(/\s+/g, ' ').trim()
  const lower = t.toLowerCase()
  let cut = t.length
  for (const tok of STOP_TOKENS) {
    const re = new RegExp(`(^|\\s)${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|\\.)`, 'i')
    const m = lower.match(re)
    if (m && m.index > 0 && m.index < cut) cut = m.index
  }
  t = t.slice(0, cut)

  // collapse consecutive duplicate words ("Executive Executive")
  const words = t.split(' ').filter(Boolean)
  const deduped = words.filter((w, i) => i === 0 || w.toLowerCase().replace(/[^a-z0-9]/g, '') !== words[i - 1].toLowerCase().replace(/[^a-z0-9]/g, ''))
  t = deduped.join(' ').replace(/[\s,;:/\-–|·]+$/g, '').replace(/^[\s,;:/\-–|·]+/g, '')

  if (t.length > 60) {
    const clipped = t.slice(0, 60)
    t = clipped.slice(0, clipped.lastIndexOf(' ') > 20 ? clipped.lastIndexOf(' ') : 60).replace(/[\s,;:/\-–|·&]+$/g, '')
  }
  if (t.length < 3) t = prettyCategory(category)
  return titleCase(t)
}

export function tidySummary(text, max = 480) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  const clipped = s.slice(0, max)
  const sentenceEnd = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '))
  if (sentenceEnd > max * 0.55) return clipped.slice(0, sentenceEnd + 1)
  return clipped.slice(0, clipped.lastIndexOf(' ')).replace(/[\s,;:]+$/, '') + '…'
}
