import PDFDocument from 'pdfkit';
import type { ReportData, ReportTable } from './model.js';

const theme = { ink: '#1C2541', line: '#3A506B', midnight: '#08132B', sky: '#5BC0DE', sand: '#F4D6B0', amber: '#D97706', surface: '#e4f3f8' };

const LEFT = 57, WIDTH = 481, BOTTOM = 726;

/** The sample's A4 cover, repeated equipment grid, remarks, measurement sheets and photo appendix. */
export async function renderReport(data: ReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false, bufferPages: true,
    info: { Title: `${data.vessel} - ${data.title}`, Author: data.company.name, Subject: `Finding analysis ${data.analysisId}` } });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  let y = 0, pageHeading = 'REMARKS';
  function font(size = 10, bold = false) { doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(theme.ink); }
  function text(value: string, x: number, top: number, width: number, size = 10, bold = false, align: 'left' | 'center' | 'right' = 'left') {
    font(size, bold); doc.text(value, x, top, { width, align, lineGap: 2 });
  }
  function header() {
    if (data.company.logo) doc.image(data.company.logo, 125, 53, { fit: [65, 55], align: 'center' });
    else {
      // Text mark occupies the same space as the supplied sample's logo.
      doc.save().rect(137, 53, 44, 45).fill(theme.midnight);
      doc.moveTo(181, 53).lineTo(164, 74).lineTo(181, 94).closePath().fill(theme.line).restore();
      doc.font('Helvetica-Bold').fontSize(15).fillColor('white').text(data.company.name === 'Marine Technical Services Ltd' ? 'MTS' : 'SM', 138, 81, { width: 43, align: 'center' });
    }
    text(data.company.name, 65, 114, 220, 11, false, 'center');
    text(data.company.name, 345, 55, 185, 7, true, 'right');
    text([data.company.address, data.company.contact].filter(Boolean).join('\n'), 345, 71, 185, 7, false, 'right');
  }
  function watermark() {
    if (!data.sample) return;
    doc.save().opacity(0.12).rotate(-52, { origin: [298, 470] });
    doc.font('Helvetica').fontSize(83).fillColor(theme.line).text('SAMPLE', 111, 430, { width: 420, align: 'center' });
    doc.restore();
  }
  function newPage(heading: string, grid = true) {
    pageHeading = heading;
    doc.addPage(); watermark(); header();
    text(heading, LEFT, 143, WIDTH, 14, true, 'center');
    y = 176;
    if (!grid) return;
    const rows = [
      ['Vessel:', data.vessel, 'Work no:', data.workNumber],
      ['Date/place:', data.datePlace, 'Machinery:', data.machinery],
      ['Manufacturer:', data.content.manufacturer || 'Not provided', 'Type:', data.equipmentType || 'Not provided'],
      ['Serial number:', data.content.serialNumber || 'Not provided', 'Running hours:', data.content.runningHours || 'Not provided'],
    ];
    rows.forEach(row => {
      font(9, true);
      const height = Math.max(19, ...[0, 1, 2, 3].map(i => doc.heightOfString(row[i], { width: i % 2 ? 140 : 91 }) + 8));
      doc.lineWidth(0.5).rect(LEFT, y, WIDTH / 2, height).rect(LEFT + WIDTH / 2, y, WIDTH / 2, height).stroke(theme.line);
      text(row[0], LEFT + 4, y + 4, 91, 9, true); text(row[1], LEFT + 99, y + 4, 137, 9, true);
      text(row[2], LEFT + WIDTH / 2 + 4, y + 4, 91, 9, true); text(row[3], LEFT + WIDTH / 2 + 99, y + 4, 137, 9, true);
      y += height;
    });
    font(10, true);
    const height = doc.heightOfString(data.title.toUpperCase(), { width: WIDTH - 12 }) + 10;
    doc.rect(LEFT, y, WIDTH, height).stroke(theme.line);
    text(data.title.toUpperCase(), LEFT + 6, y + 5, WIDTH - 12, 10, true, 'center');
    y += height + 20;
  }
  function ensure(height: number) { if (y + height > BOTTOM) newPage(pageHeading); }
  function paragraph(value: string, bold = false) {
    // Chunk even unusually long AI paragraphs across pages, preserving every word.
    let remaining = value.trim();
    while (remaining) {
      ensure(40); font(10, bold);
      const words = remaining.split(/\s+/);
      let low = 1, high = words.length, count = 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const height = doc.heightOfString(words.slice(0, mid).join(' '), { width: WIDTH - 36, lineGap: 3 });
        if (height <= BOTTOM - y) { count = mid; low = mid + 1; } else high = mid - 1;
      }
      const part = words.slice(0, count).join(' ');
      doc.text(part, LEFT + 18, y, { width: WIDTH - 36, lineGap: 3 });
      y = doc.y + 11;
      remaining = words.slice(count).join(' ');
      if (remaining) newPage(pageHeading);
    }
  }
  function table(sheet: ReportTable, heading: string) {
    newPage(heading);
    paragraph(sheet.title, true);
    const cellWidth = WIDTH / sheet.columns.length;
    const drawRow = (row: string[], head = false) => {
      font(8, head);
      // Split large cells as well as long tables; no row may cross the footer.
      const fragments = row.map(cell => {
        let low = 0, high = cell.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (doc.heightOfString(cell.slice(0, mid), { width: cellWidth - 10, lineGap: 2 }) <= 210) low = mid;
          else high = mid - 1;
        }
        return [cell.slice(0, low), cell.slice(low)];
      });
      const height = Math.max(22, ...fragments.map(([cell]) => doc.heightOfString(cell || '-', { width: cellWidth - 10, lineGap: 2 }) + 10));
      if (y + height > BOTTOM) { newPage(heading); drawRow(sheet.columns, true); }
      fragments.forEach(([cell], i) => {
        if (head) doc.rect(LEFT + i * cellWidth, y, cellWidth, height).fill(theme.surface);
        doc.rect(LEFT + i * cellWidth, y, cellWidth, height).lineWidth(0.4).stroke(theme.line);
        text(cell || '-', LEFT + i * cellWidth + 5, y + 5, cellWidth - 10, 8, head);
      });
      y += height;
      if (fragments.some(([, rest]) => rest)) drawRow(fragments.map(([, rest]) => rest));
    };
    drawRow(sheet.columns, true);
    sheet.rows.forEach(row => drawRow(row));
    y += 16;
    if (sheet.notes) paragraph(sheet.notes);
  }
  try {
    doc.addPage(); watermark(); header();
    doc.lineWidth(0.65).rect(181, 281, 223, 245).moveTo(181, 404).lineTo(404, 404).stroke(theme.line);
    const cover = [data.vessel.toUpperCase(), data.title.toUpperCase(), data.datePlace].join('\n');
    let size = 15;
    font(size, true);
    while (doc.heightOfString(cover, { width: 205, lineGap: 3 }) > 105 && size > 8) { size--; font(size, true); }
    doc.text(cover, 190, 298, { width: 205, align: 'center', lineGap: 3 });
    text('REPORT', 190, 454, 205, 22, true, 'center');
    text(`PREPARED BY\n${data.company.name}\n${data.preparedBy}`, 105, 588, 385, 11, false, 'center');
    text(`Client: ${data.client}\nAnalysis: ${data.analysisDate}`, 105, 666, 385, 9, false, 'center');
    newPage('REMARKS');
    for (const section of data.content.remarks) {
      ensure(65); paragraph(section.heading, true);
      section.paragraphs.forEach(value => paragraph(value));
    }
    if (data.content.recommendations.length) {
      ensure(65); paragraph('Recommendations / additional information', true);
      data.content.recommendations.forEach(value => paragraph(`- ${value}`));
    }
    if (!data.content.measurements.length) paragraph('Measurements: no verified measurement table was supplied in the analysed evidence.');
    if (!data.content.trials.length) paragraph('Trials: no verified trial readings were supplied in the analysed evidence.');
    for (const sheet of data.content.measurements) table(sheet, 'MEASUREMENT REPORT');
    for (const graph of data.content.graphs) {
      newPage('MEASUREMENTS - GRAPH'); paragraph(`${graph.title} (Unit: ${graph.unit})`, true);
      const top = y + 20, height = 235, left = LEFT + 45, width = WIDTH - 75;
      const values = graph.series.flatMap(series => series.values);
      const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
      for (let i = 0; i <= 5; i++) {
        const gy = top + height - i * height / 5;
        doc.moveTo(left, gy).lineTo(left + width, gy).lineWidth(0.3).stroke('#cccccc');
        text((min + span * i / 5).toFixed(2), LEFT, gy - 4, 38, 7, false, 'right');
      }
      graph.labels.forEach((label, i) => text(label, left + i * width / (graph.labels.length - 1) - 13, top + height + 8, 26, 7, false, 'center'));
      const colors = [theme.midnight, theme.amber, theme.line, theme.sky];
      graph.series.forEach((series, index) => {
        doc.lineWidth(1).strokeColor(colors[index]);
        series.values.forEach((value, i) => {
          const x = left + i * width / (series.values.length - 1), gy = top + height - (value - min) / span * height;
          if (i === 0) doc.moveTo(x, gy); else doc.lineTo(x, gy);
        });
        doc.stroke();
        doc.moveTo(left, top + height + 35 + index * 18).lineTo(left + 24, top + height + 35 + index * 18).stroke(colors[index]);
        text(series.name, left + 32, top + height + 31 + index * 18, width - 32, 9);
      });
      y = top + height + 45 + graph.series.length * 18;
    }
    for (const sheet of data.content.trials) table(sheet, 'TRIALS');
    if (data.evidence.length) {
      newPage('MEDIA EVIDENCE');
      data.evidence.forEach(item => {
        ensure(65); paragraph(`${item.label} - ${item.name} (${item.type})`, true);
        paragraph(item.summary || 'No saved evidence summary.');
        if (item.notice) paragraph(item.notice);
      });
      const photos = data.evidence.filter(item => item.image);
      for (let index = 0; index < photos.length; index += 4) {
        newPage('PHOTOGRAPHIC DOCUMENTATION', false);
        photos.slice(index, index + 4).forEach((item, position) => {
          const x = LEFT + 18 + (position % 2) * 235, top = 200 + Math.floor(position / 2) * 250;
          doc.image(item.image!, x, top, { fit: [210, 205], align: 'center', valign: 'center' });
          text(`${item.label} - ${item.name}`, x, top + 212, 210, 8, false, 'center');
        });
      }
    }
    const { count } = doc.bufferedPageRange();
    for (let i = 0; i < count; i++) {
      doc.switchToPage(i);
      text(`Page ${i + 1} of ${count}`, LEFT, 746, WIDTH, 8, false, 'right');
      text(data.sample ? 'SAMPLE - demonstration data, not an inspection certificate' : 'AI-assisted report - engineering review required', LEFT, 775, WIDTH, 8, false, 'center');
      text(`Work ${data.workNumber} | Analysis ${data.analysisId}`, LEFT, 792, WIDTH, 7, false, 'center');
    }
    doc.end();
  } catch (error) { doc.destroy(error instanceof Error ? error : new Error('PDF generation failed')); }
  return complete;
}
