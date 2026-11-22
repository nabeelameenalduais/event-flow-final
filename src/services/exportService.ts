export type ExportFormat = "csv" | "xlsx" | "pdf" | "json" | "print"

export interface ExportColumn {
  key: string
  label: string
}

export interface ExportOptions {
  title?: string
  filename: string
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeCsv(value: unknown): string {
  if (value === undefined || value === null) return ""
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function normalizeCell(value: unknown): string | number {
  if (value === undefined || value === null) return ""
  if (typeof value === "number" || typeof value === "string") return value
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.join(", ")
  return JSON.stringify(value)
}

export function rowsToCsv(columns: ExportColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => escapeCsv(c.label)).join(",")
  const body = rows.map((row) => columns.map((c) => escapeCsv(row[c.key])).join(","))
  return [header, ...body].join("\r\n")
}

export async function exportRows(format: ExportFormat, options: ExportOptions): Promise<void> {
  const { title = options.filename, filename, columns, rows } = options

  if (format === "csv") {
    const csv = rowsToCsv(columns, rows)
    downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`)
    return
  }

  if (format === "json") {
    const json = JSON.stringify(
      rows.map((row) => Object.fromEntries(columns.map((c) => [c.key, row[c.key] ?? null]))),
      null,
      2,
    )
    downloadBlob(new Blob([json], { type: "application/json;charset=utf-8;" }), `${filename}.json`)
    return
  }

  if (format === "xlsx") {
    const XLSX = await import("xlsx")
    const data = rows.map((row) => Object.fromEntries(columns.map((c) => [c.label, normalizeCell(row[c.key])])))
    const sheet = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.label) })
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, title.slice(0, 31) || "Export")
    XLSX.writeFile(book, `${filename}.xlsx`)
    return
  }

  if (format === "pdf") {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
    const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait", unit: "pt" })
    doc.setFontSize(14)
    doc.text(title, 40, 40)
    autoTable(doc, {
      startY: 60,
      head: [columns.map((c) => c.label)],
      body: rows.map((row) => columns.map((c) => String(normalizeCell(row[c.key])))),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [20, 160, 150] },
      margin: { left: 30, right: 30 },
    })
    doc.save(`${filename}.pdf`)
    return
  }

  // print
  const win = window.open("", "_blank", "noopener,noreferrer")
  if (!win) {
    throw new Error("Please allow pop-ups to print this report")
  }
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(String(normalizeCell(row[c.key])))}</td>`).join("")}</tr>`)
    .join("")
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 16px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left}
      th{background:#f3f4f6}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=()=>window.print()</script>
    </body></html>`)
  win.document.close()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
