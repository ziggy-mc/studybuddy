export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

function makeCard(term, definition, index) {
  return {
    id: crypto.randomUUID(),
    term: String(term ?? '').trim(),
    definition: String(definition ?? '').trim(),
    notes: '',
    starred: false,
    order: index,
  };
}

export function parsePastedText(input, format = 'auto') {
  const text = String(input || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  if (format === 'tab' || (format === 'auto' && lines.some((line) => line.includes('\t')))) {
    return lines.map((line, index) => {
      const parts = line.split('\t');
      return makeCard(parts.shift(), parts.join(' ').trim(), index);
    }).filter((card) => card.term && card.definition);
  }

  if (format === 'alternating') {
    const cards = [];
    for (let index = 0; index + 1 < lines.length; index += 2) cards.push(makeCard(lines[index], lines[index + 1], cards.length));
    return cards;
  }

  if (format === 'paragraphs') {
    const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    return blocks.map((block, index) => {
      const rows = block.split('\n').map((line) => line.trim()).filter(Boolean);
      return makeCard(rows[0], rows.slice(1).join(' '), index);
    }).filter((card) => card.term && card.definition);
  }

  if (lines.some((line) => /^(question|q)\s*:/i.test(line)) && lines.some((line) => /^(answer|a)\s*:/i.test(line))) {
    const pairs = [];
    let question = '';
    let answer = '';
    for (const line of lines) {
      if (/^(question|q)\s*:/i.test(line)) {
        if (question && answer) pairs.push(makeCard(question, answer, pairs.length));
        question = line.replace(/^(question|q)\s*:/i, '').trim();
        answer = '';
      } else if (/^(answer|a)\s*:/i.test(line)) {
        answer = line.replace(/^(answer|a)\s*:/i, '').trim();
      } else if (answer) answer += ` ${line}`;
      else if (question) question += ` ${line}`;
    }
    if (question && answer) pairs.push(makeCard(question, answer, pairs.length));
    if (pairs.length) return pairs;
  }

  const cards = [];
  for (const line of lines) {
    const match = line.match(/^(.{1,200}?)\s*(?:\t|\s[-–—:]\s|:\s+|\s\|\s)(.+)$/);
    if (match) cards.push(makeCard(match[1], match[2], cards.length));
  }
  if (cards.length) return cards;

  const qna = [];
  let question = '';
  let answer = '';
  for (const line of lines) {
    if (/^(question|q)\s*:/i.test(line)) {
      if (question && answer) qna.push(makeCard(question, answer, qna.length));
      question = line.replace(/^(question|q)\s*:/i, '').trim();
      answer = '';
    } else if (/^(answer|a)\s*:/i.test(line)) {
      answer = line.replace(/^(answer|a)\s*:/i, '').trim();
    } else if (answer) {
      answer += ` ${line}`;
    } else if (question) {
      question += ` ${line}`;
    }
  }
  if (question && answer) qna.push(makeCard(question, answer, qna.length));
  return qna;
}


export function pdfItemsToText(items) {
  const lines = [];
  let currentLine = '';
  let previousY = null;

  for (const item of items || []) {
    const value = String(item?.str || '').trim();
    if (!value) continue;
    const y = Number(item?.transform?.[5]);
    const movedToAnotherLine = Number.isFinite(y) && Number.isFinite(previousY) && Math.abs(y - previousY) > 2.5;
    if (movedToAnotherLine && currentLine.trim()) {
      lines.push(currentLine.trim());
      currentLine = '';
    }
    currentLine = `${currentLine}${currentLine ? ' ' : ''}${value}`;
    if (Number.isFinite(y)) previousY = y;
    if (item?.hasEOL && currentLine.trim()) {
      lines.push(currentLine.trim());
      currentLine = '';
      previousY = null;
    }
  }

  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.join('\n');
}

function stripRtf(input) {
  return input
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-f]{2}/gi, ' ')
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)))
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim();
}

export async function extractFile(file) {
  if (!file) throw new Error('Choose a file to import.');
  if (file.size === 0) throw new Error('This file is empty. Choose a file that contains study material.');
  if (file.size > MAX_IMPORT_BYTES) throw new Error('This file is larger than 20 MB. Try exporting a smaller document or spreadsheet.');
  const extension = file.name.toLowerCase().split('.').pop();

  if (extension === 'gdoc' || extension === 'gsheet') {
    throw new Error(`A .${extension} file is only a Google Drive shortcut, not the document itself. Open it in Google ${extension === 'gdoc' ? 'Docs' : 'Sheets'}, then choose File → Download and export as .docx or .xlsx.`);
  }
  if (extension === 'doc') {
    throw new Error('Legacy .doc files are not parsed directly in this browser importer. Open the file in Word or Google Docs and export it as .docx or .pdf.');
  }

  if (extension === 'txt') {
    const text = await file.text();
    return { kind: 'text', text, cards: parsePastedText(text) };
  }
  if (extension === 'rtf') {
    const text = stripRtf(await file.text());
    return { kind: 'text', text, cards: parsePastedText(text) };
  }
  if (extension === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { kind: 'text', text: result.value, cards: parsePastedText(result.value) };
  }
  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false });
    try {
      const pdf = await loadingTask.promise;
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(pdfItemsToText(content.items));
        page.cleanup();
      }
      const text = pages.filter(Boolean).join('\n\n');
      return { kind: 'text', text, cards: parsePastedText(text) };
    } finally {
      await loadingTask.destroy();
    }
  }
  if (['xlsx', 'xls', 'ods', 'csv'].includes(extension)) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const sheets = workbook.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: '' })
        .filter((row) => row.some((cell) => String(cell).trim())),
    }));
    return { kind: 'spreadsheet', sheets };
  }
  throw new Error('Unsupported file type. Use DOCX, TXT, RTF, PDF, XLSX, XLS, CSV, or ODS.');
}

export function spreadsheetCards(rows, termColumn, definitionColumn, hasHeader = false) {
  const start = hasHeader ? 1 : 0;
  return rows.slice(start).map((row, index) => makeCard(row?.[termColumn], row?.[definitionColumn], index))
    .filter((card) => card.term && card.definition);
}
