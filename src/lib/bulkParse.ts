/**
 * Cú pháp thêm nhiều việc: mỗi dòng một việc.
 *   [giờ bắt đầu[-giờ kết thúc]] Tên việc
 * Giờ viết 08:00, 8:30 hoặc 8h30 / 8h. Không có giờ → việc cả ngày.
 * Dòng trống và dòng bắt đầu bằng # bị bỏ qua.
 */
export interface ParsedLine {
  line: number
  raw: string
  title?: string
  start?: string // HH:mm
  end?: string // HH:mm
  error?: string
}

const RE = /^(\d{1,2})(?::|h)(\d{2})?\s*(?:[-–—~]\s*(\d{1,2})(?::|h)(\d{2})?)?\s+(.+)$/i

const pad = (n: number) => String(n).padStart(2, '0')

function time(h: string, m: string | undefined): string | null {
  const hh = Number(h)
  const mm = m === undefined ? 0 : Number(m)
  if (hh > 23 || mm > 59) return null
  return `${pad(hh)}:${pad(mm)}`
}

export function parseBulk(text: string): ParsedLine[] {
  const out: ParsedLine[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const s = raw.trim()
    if (!s || s.startsWith('#')) return
    const base = { line: i + 1, raw: s }

    const m = RE.exec(s)
    if (!m) {
      out.push(s.length > 200 ? { ...base, error: 'Tên việc dài quá 200 ký tự' } : { ...base, title: s })
      return
    }
    const [, h1, m1, h2, m2, titleRaw] = m
    const title = titleRaw.trim()
    const start = time(h1, m1)
    if (!start) return void out.push({ ...base, error: 'Giờ bắt đầu không hợp lệ' })
    let end: string | undefined
    if (h2 !== undefined) {
      const e = time(h2, m2)
      if (!e) return void out.push({ ...base, error: 'Giờ kết thúc không hợp lệ' })
      if (e <= start) return void out.push({ ...base, error: 'Giờ kết thúc phải sau giờ bắt đầu' })
      end = e
    }
    if (title.length > 200) return void out.push({ ...base, error: 'Tên việc dài quá 200 ký tự' })
    out.push({ ...base, title, start, end })
  })
  return out
}
