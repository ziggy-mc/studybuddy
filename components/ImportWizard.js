'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, FileSpreadsheet, FileText, Plus, Sparkles, Trash2, UploadCloud, X, RefreshCw } from 'lucide-react';
import { extractFile, parsePastedText, spreadsheetCards, MAX_IMPORT_BYTES } from '@/lib/importers';
import { createEmptySet, saveSet } from '@/lib/storage';
import { importJsonFile } from '@/lib/export';

const FORMATS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'tab', label: 'Tab-separated columns' },
  { value: 'alternating', label: 'Alternating term / definition lines' },
  { value: 'paragraphs', label: 'Paragraph blocks' },
];

function guessHeader(rows) {
  const first = (rows?.[0] || []).map((value) => String(value).toLowerCase().trim());
  const term = first.findIndex((value) => /^(term|front|question|word|concept|prompt)$/i.test(value));
  const definition = first.findIndex((value) => /^(definition|back|answer|meaning|description|response)$/i.test(value));
  const termColumn = term >= 0 ? term : 0;
  const fallbackDefinition = first.length > 1 ? (termColumn === 0 ? 1 : 0) : 0;
  return { term: termColumn, definition: definition >= 0 ? definition : fallbackDefinition, header: term >= 0 || definition >= 0 };
}

function makeBlankCard(order) {
  return { id: crypto.randomUUID(), term: '', definition: '', notes: '', starred: false, order };
}

export default function ImportWizard() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [method, setMethod] = useState('paste');
  const [paste, setPaste] = useState('');
  const [format, setFormat] = useState('auto');
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [termColumn, setTermColumn] = useState(0);
  const [definitionColumn, setDefinitionColumn] = useState(1);
  const [hasHeader, setHasHeader] = useState(false);
  const [cards, setCards] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Uncategorized');
  const [tagsText, setTagsText] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [dragging, setDragging] = useState(false);

  const currentRows = spreadsheet?.sheets?.[sheetIndex]?.rows || [];
  const columnCount = Math.max(2, ...currentRows.slice(0, 10).map((row) => row.length));
  const currentSheetCards = useMemo(
    () => spreadsheet ? spreadsheetCards(currentRows, termColumn, definitionColumn, hasHeader) : [],
    [spreadsheet, currentRows, termColumn, definitionColumn, hasHeader],
  );
  const completeCardCount = cards.filter((card) => card.term.trim() && card.definition.trim()).length;

  function setCard(index, field, value) {
    setCards((items) => items.map((card, itemIndex) => itemIndex === index ? { ...card, [field]: value } : card));
  }

  function addCard() {
    setCards((items) => [...items, makeBlankCard(items.length)]);
  }

  function removeCard(index) {
    setCards((items) => items.filter((_, itemIndex) => itemIndex !== index).map((card, order) => ({ ...card, order })));
  }

  function duplicateCard(index) {
    setCards((items) => {
      const copy = { ...items[index], id: crypto.randomUUID() };
      const next = [...items];
      next.splice(index + 1, 0, copy);
      return next.map((card, order) => ({ ...card, order }));
    });
  }

  function moveCard(index, delta) {
    setCards((items) => {
      const next = [...items];
      const destination = index + delta;
      if (destination < 0 || destination >= next.length) return items;
      [next[index], next[destination]] = [next[destination], next[index]];
      return next.map((card, order) => ({ ...card, order }));
    });
  }

  function buildFromPaste(value = paste, selectedFormat = format) {
    setPaste(value);
    const parsed = parsePastedText(value, selectedFormat);
    setCards(parsed);
    setError(parsed.length ? '' : 'No question-and-answer pairs were detected. Try another format, or add cards manually.');
    if (!title.trim()) setTitle(fileName ? fileName.replace(/\.[^.]+$/, '') : 'Pasted study material');
  }

  function applySpreadsheet() {
    if (termColumn === definitionColumn) {
      setError('Choose two different columns for terms and definitions.');
      return;
    }
    setCards(currentSheetCards);
    if (!title.trim()) setTitle(spreadsheet?.sheets?.[sheetIndex]?.name || 'Imported spreadsheet');
    setError(currentSheetCards.length ? '' : 'No complete term-and-definition rows were found. Check the selected columns and header setting.');
  }

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setWorking(true);
    setFileName(file.name);
    setSpreadsheet(null);
    setRawText('');
    setPaste('');
    setCards([]);
    try {
      if (file.size === 0) throw new Error('This file is empty. Choose a file that contains study material.');
      if (file.size > MAX_IMPORT_BYTES) throw new Error('This file is larger than 20 MB. Try exporting a smaller document or spreadsheet.');
      if (file.name.toLowerCase().endsWith('.json')) {
        const imported = await importJsonFile(file);
        setCards(imported.cards);
        setTitle(imported.title);
        setDescription(imported.description || '');
        setCategory(imported.category || 'Uncategorized');
        setTagsText((imported.tags || []).join(', '));
        setError(imported.cards.length ? '' : 'This backup does not contain any complete flashcards.');
        return;
      }
      const result = await extractFile(file);
      if (result.kind === 'spreadsheet') {
        if (!result.sheets?.length) throw new Error('No worksheets with data were found in this spreadsheet.');
        setSpreadsheet(result);
        setSheetIndex(0);
        const guessed = guessHeader(result.sheets[0]?.rows || []);
        setTermColumn(guessed.term);
        setDefinitionColumn(guessed.definition);
        setHasHeader(guessed.header);
        setTitle(file.name.replace(/\.[^.]+$/, ''));
      } else {
        setRawText(result.text || '');
        setPaste(result.text || '');
        setFormat('auto');
        setCards(result.cards || []);
        setTitle(file.name.replace(/\.[^.]+$/, ''));
        if (!result.cards?.length) {
          setError('The text was extracted, but automatic detection did not find any card pairs. Choose an import format below or add cards manually.');
        }
      }
    } catch (fileError) {
      setError(fileError.message || 'The file could not be read. Try exporting it as DOCX, PDF, XLSX, CSV, or TXT.');
    } finally {
      setWorking(false);
    }
  }

  function onFileInputChange(event) {
    const file = event.target.files?.[0];
    // Reset immediately so selecting the same file a second time still fires change.
    event.target.value = '';
    handleFile(file);
  }

  async function createStudySet() {
    const validCards = cards
      .filter((card) => card.term.trim() && card.definition.trim())
      .map((card, order) => ({ ...card, order }));
    if (!title.trim()) return setError('Add a title for this study set.');
    if (!validCards.length) return setError('Add at least one complete card before creating your set.');
    if (validCards.length > 500) return setError('A study set can contain up to 500 cards.');
    setWorking(true);
    setError('');
    try {
      const set = createEmptySet(title.trim());
      set.description = description.trim();
      set.category = category.trim() || 'Uncategorized';
      set.tags = [...new Set(tagsText.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
      set.cards = validCards;
      set.updatedAt = new Date().toISOString();
      await saveSet(set);
      router.push(`/sets/${set.id}`);
    } catch (saveError) {
      setError(saveError.message || 'Could not save your study set in this browser. Check available browser storage and try again.');
      setWorking(false);
    }
  }

  function switchMethod(nextMethod) {
    setMethod(nextMethod);
    setError('');
    if (nextMethod === 'manual' && !cards.length) {
      setCards([makeBlankCard(0)]);
      if (!title.trim()) setTitle('New study set');
    }
  }

  return (
    <div className="page-wrap narrow-page import-page">
      <Link href="/" className="back-link"><ArrowLeft size={15} /> Back to your library</Link>
      <div className="page-title-block"><span className="eyebrow">BUILD YOUR SET</span><h1>Create study material<span className="accent-dot">.</span></h1><p>Start with a blank set, paste notes, or import a document. Files are processed in this browser and are not uploaded.</p></div>

      <div className="import-methods" role="tablist" aria-label="Choose an import method">
        <button className={`method-tab ${method === 'paste' ? 'active' : ''}`} onClick={() => switchMethod('paste')} role="tab" aria-selected={method === 'paste'}><FileText size={17} /><span><strong>Paste text</strong><small>Notes, terms, Q&A</small></span></button>
        <button className={`method-tab ${method === 'file' ? 'active' : ''}`} onClick={() => switchMethod('file')} role="tab" aria-selected={method === 'file'}><UploadCloud size={17} /><span><strong>Upload a file</strong><small>Documents, sheets, PDFs</small></span></button>
        <button className={`method-tab ${method === 'manual' ? 'active' : ''}`} onClick={() => switchMethod('manual')} role="tab" aria-selected={method === 'manual'}><Plus size={17} /><span><strong>Start from scratch</strong><small>Build every card</small></span></button>
      </div>

      {method === 'paste' && <section className="panel import-panel">
        <div className="panel-heading"><div><h2>Paste your study material</h2><p>One pair per line works best. You can edit every card before saving.</p></div><Sparkles size={19} /></div>
        <textarea className="paste-area" rows={10} value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={'Photosynthesis - The process plants use to turn light into chemical energy\nMitochondria: The organelle that produces most cellular ATP\nOsmosis\tMovement of water across a selectively permeable membrane'} />
        <div className="import-controls"><label>Import format<select value={format} onChange={(event) => setFormat(event.target.value)}>{FORMATS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className="button button-primary" onClick={() => buildFromPaste()} disabled={!paste.trim()}><Sparkles size={15} /> Detect flashcards</button></div>
        <p className="helper-text">Supported patterns include Term - Definition, Term: Definition, tab-separated columns, alternating lines, and paragraph blocks.</p>
      </section>}

      {method === 'file' && <section className="panel import-panel">
        <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files?.[0]); }}>
          <div className="drop-icon"><UploadCloud size={24} /></div><h2>Drop a file to import</h2><p>Or choose a file from your device. Maximum size: 20 MB.</p>
          <button type="button" className="button button-primary" onClick={() => fileRef.current?.click()} disabled={working}><UploadCloud size={16} /> Choose a file</button>
          <input ref={fileRef} type="file" className="visually-hidden" aria-label="Choose a study file to import" accept=".docx,.doc,.txt,.rtf,.pdf,.xlsx,.xls,.csv,.ods,.json,.gdoc,.gsheet" onChange={onFileInputChange} />
          <div className="file-types"><span>DOCX</span><span>PDF</span><span>TXT</span><span>RTF</span><span>XLSX</span><span>XLS</span><span>CSV</span><span>ODS</span><span>JSON</span></div>
        </div>
        {working && <div className="inline-loading"><span className="spinner" /> Reading file locally…</div>}
        {fileName && <div className="selected-file"><FileText size={15} /><span>{fileName}</span><button className="icon-button" title="Clear imported file" onClick={() => { setFileName(''); setRawText(''); setSpreadsheet(null); setCards([]); setError(''); }}><X size={15} /></button></div>}
        <div className="format-notes"><p><strong>Google Docs / Sheets:</strong> download a .docx or .xlsx file first. A .gdoc or .gsheet shortcut is not the actual document.</p><p><strong>Legacy .doc:</strong> open it in Word or Google Docs and export as .docx or PDF.</p><p><strong>Privacy:</strong> document parsing happens in your browser. The original file is not sent to the StudyDeck server.</p></div>

        {spreadsheet && <div className="sheet-options">
          <div className="panel-heading"><div><h3><FileSpreadsheet size={17} /> Spreadsheet options</h3><p>Choose the worksheet and columns that contain each side of the card.</p></div></div>
          <div className="spreadsheet-selects"><label>Worksheet<select value={sheetIndex} onChange={(event) => { const nextIndex = Number(event.target.value); setSheetIndex(nextIndex); const guess = guessHeader(spreadsheet.sheets[nextIndex]?.rows || []); setTermColumn(guess.term); setDefinitionColumn(guess.definition); setHasHeader(guess.header); }}>
            {spreadsheet.sheets.map((sheet, index) => <option value={index} key={`${sheet.name}-${index}`}>{sheet.name}</option>)}
          </select></label>
            <label>Term / question column<select value={termColumn} onChange={(event) => setTermColumn(Number(event.target.value))}>{Array.from({ length: columnCount }, (_, index) => <option key={index} value={index}>Column {String.fromCharCode(65 + (index % 26))}</option>)}</select></label>
            <label>Definition / answer column<select value={definitionColumn} onChange={(event) => setDefinitionColumn(Number(event.target.value))}>{Array.from({ length: columnCount }, (_, index) => <option key={index} value={index}>Column {String.fromCharCode(65 + (index % 26))}</option>)}</select></label>
          </div>
          <label className="checkbox-line"><input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.target.checked)} /> First row contains column headers</label>
          <div className="spreadsheet-preview"><strong>Preview</strong><div className="spreadsheet-preview-grid">{currentRows.slice(0, 4).map((row, rowIndex) => <div className={`spreadsheet-row ${rowIndex === 0 && hasHeader ? 'header-row' : ''}`} key={rowIndex}><span>{String(row[termColumn] ?? '')}</span><span>{String(row[definitionColumn] ?? '')}</span></div>)}</div><button className="button button-primary button-small" onClick={applySpreadsheet}><Check size={14} /> Use these columns ({currentSheetCards.length} cards)</button></div>
        </div>}

        {rawText && !spreadsheet && <div className="extracted-review-tools">
          <div className="panel-heading"><div><h3>Text extracted successfully</h3><p>Try a different format without uploading the file again.</p></div><RefreshCw size={17} /></div>
          <div className="import-controls"><label>Import format<select value={format} onChange={(event) => setFormat(event.target.value)}>{FORMATS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className="button button-outline button-small" onClick={() => buildFromPaste(rawText, format)}><Sparkles size={14} /> Re-detect cards</button></div>
          <details className="extracted-text"><summary>View extracted text</summary><pre>{rawText.slice(0, 20000)}</pre></details>
        </div>}
      </section>}

      

      {error && <div className="notice error-notice" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

      {(cards.length > 0 || method === 'manual') && <section className="preview-section">
        <div className="section-heading"><div><span className="eyebrow">REVIEW BEFORE SAVING</span><h2>Card preview <span className="count-pill">{cards.length}</span></h2><p className="muted">Check the extraction and make corrections before creating the set.</p></div><button className="button button-outline button-small" onClick={addCard}><Plus size={15} /> Add card</button></div>
        <div className="set-details-form set-details-form-wide"><label>Study set title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Biology - Cell structure" maxLength={120} /></label><label>Description <span className="optional">Optional</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you studying?" maxLength={1000} /></label><label>Category / folder<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Biology" maxLength={80} /></label><label>Tags <span className="optional">Optional, comma separated</span><input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="exam, chapter 4" maxLength={500} /></label></div>
        <div className="import-card-list">{cards.map((card, index) => <div className="edit-card-row import-card-row" key={card.id || index}><div className="edit-card-number">{String(index + 1).padStart(2, '0')}</div><label><span>Term / question</span><textarea rows={2} value={card.term} onChange={(event) => setCard(index, 'term', event.target.value)} placeholder="Enter a term or question" /></label><label><span>Definition / answer</span><textarea rows={2} value={card.definition} onChange={(event) => setCard(index, 'definition', event.target.value)} placeholder="Enter the definition or answer" /></label><div className="edit-card-actions"><button className="icon-button" title="Move card up" disabled={index === 0} onClick={() => moveCard(index, -1)}>↑</button><button className="icon-button" title="Move card down" disabled={index === cards.length - 1} onClick={() => moveCard(index, 1)}>↓</button><button className="icon-button" title="Duplicate card" onClick={() => duplicateCard(index)}><Copy size={15} /></button><button className="icon-button danger-icon" title="Remove card" onClick={() => removeCard(index)}><Trash2 size={15} /></button></div></div>)}</div>
        <div className="create-set-footer"><span className="muted">{completeCardCount} complete cards · Saved locally in this browser</span><button className="button button-primary" onClick={createStudySet} disabled={working || !completeCardCount}><Check size={16} /> {working ? 'Saving…' : 'Create study set'}</button></div>
      </section>}
    </div>
  );
}
