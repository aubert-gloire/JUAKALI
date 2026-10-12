export interface ExportCol<T> {
  label: string;
  value: (row: T) => string | number;
}

export async function exportPDF<T>(rows: T[], cols: ExportCol<T>[], title: string) {
  const { jsPDF } = await import('jspdf');
  const isWide = cols.length > 5;
  const doc = new jsPDF({ orientation: isWide ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const usableW = pageW - margin * 2;
  const colW = usableW / cols.length;
  const rowH = 7;
  let y = margin;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y + 7);
  y += 13;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text(`${new Date().toLocaleString('en-RW')} · ${rows.length} records`, margin, y);
  y += 7;
  doc.setTextColor(0, 0, 0);

  doc.setFillColor(234, 88, 12);
  doc.rect(margin, y, usableW, rowH, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  cols.forEach((col, i) => {
    const maxC = Math.max(4, Math.floor(colW / 1.8));
    const text = col.label.length > maxC ? col.label.slice(0, maxC - 1) + '…' : col.label;
    doc.text(text.toUpperCase(), margin + i * colW + 2, y + 4.5);
  });
  y += rowH;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  rows.forEach((row, ri) => {
    if (y + rowH > pageH - margin) { doc.addPage(); y = margin; }
    if (ri % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, usableW, rowH, 'F');
    }
    cols.forEach((col, i) => {
      const maxC = Math.max(4, Math.floor(colW / 1.6));
      const raw = String(col.value(row));
      const text = raw.length > maxC ? raw.slice(0, maxC - 1) + '…' : raw;
      doc.text(text, margin + i * colW + 2, y + 4.5);
    });
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y + rowH, margin + usableW, y + rowH);
    y += rowH;
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportCSV<T>(rows: T[], cols: ExportCol<T>[], filename: string) {
  const header = cols.map((c) => `"${c.label}"`).join(',');
  const body = rows
    .map((r) => cols.map((c) => `"${String(c.value(r)).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printTable<T>(rows: T[], cols: ExportCol<T>[], title: string) {
  const thead = cols.map((c) => `<th>${c.label}</th>`).join('');
  const tbody = rows
    .map((r) => `<tr>${cols.map((c) => `<td>${c.value(r)}</td>`).join('')}</tr>`)
    .join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body{font-family:sans-serif;font-size:12px;padding:20px}
    h2{margin-bottom:4px}p{margin:0 0 12px;color:#555}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f5f5f5;font-weight:600}
    tr:nth-child(even){background:#fafafa}
    @media print{body{padding:0}}
  </style></head><body>
    <h2>${title}</h2>
    <p>Printed ${new Date().toLocaleString('en-RW')} · ${rows.length} records</p>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
