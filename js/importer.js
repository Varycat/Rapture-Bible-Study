// Study import parsing: turns pasted text / TXT / HTML into a draft study
// structure {title, language, topics:[{title, verses, content}]}.
// Pure functions — no DOM access except parseStudyHTML's DOMParser.

const VERSE_RE = /\b(?:[1-3]\s?)?[A-ZÁÉÍÓÚ][a-záéíóúñ]+\.?\s\d{1,3}[:.]\d{1,3}(?:\s?[-–]\s?\d{1,3})?/g;

function detectLanguage(text) {
  const lower = text.toLowerCase();
  const es = (lower.match(/\b(que|según|de la|el|los|las|dios|versículo|iglesia|estudio|biblia|día|muerte|cuando)\b/g) || []).length;
  const en = (lower.match(/\b(the|and|of|god|that|study|church|verse|bible|when|death|according)\b/g) || []).length;
  return es > en ? 'es' : 'en';
}

function versesIn(text) {
  return [...new Set((text.match(VERSE_RE) || []).map(v => v.trim()))].slice(0, 40);
}

function looksLikeHeading(line) {
  if (line.length > 90) return false;
  if (/^\d{1,2}[.)]\s+\S/.test(line)) return true;                        // "1. Introduction"
  if (/[:：]$/.test(line)) return true;                                     // "Historical context:"
  const letters = line.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  if (letters.length >= 3 && line === line.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(line)) return true; // ALL CAPS
  return false;
}

export function parseStudyText(raw, fileName = '') {
  raw = String(raw || '').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/).map(l => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const title = (nonEmpty[0] || fileName || 'Imported Study').replace(/[:：]$/, '').slice(0, 120);
  const secs = [];
  let cur = null;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (looksLikeHeading(l) && secs.length < 40) {
      cur = { title: l.replace(/^\d{1,2}[.)]\s+/, '').replace(/[:：]$/, '').slice(0, 100), content: '' };
      secs.push(cur);
    } else {
      if (!cur) { cur = { title: 'Introduction', content: '' }; secs.push(cur); }
      cur.content += (cur.content ? '\n' : '') + l;
    }
  }
  if (!secs.length) secs.push({ title: 'Content', content: nonEmpty.slice(1).join('\n') });
  return {
    title,
    language: detectLanguage(raw),
    topics: secs.filter(x => x.title || x.content).map(x => ({ title: x.title, content: x.content, verses: versesIn(x.title + ' ' + x.content) }))
  };
}

export function parseStudyHTML(html, fileName = '') {
  const docp = new DOMParser().parseFromString(html, 'text/html');
  docp.querySelectorAll('script,style,nav,footer,header,noscript,iframe').forEach(el => el.remove());
  const title = (docp.querySelector('h1')?.textContent || docp.querySelector('title')?.textContent || docp.querySelector('h2')?.textContent || fileName || 'Imported Study').trim().slice(0, 120);
  const secs = [];
  let cur = null;
  docp.body.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,td').forEach(el => {
    const tx = el.textContent.replace(/\s+/g, ' ').trim();
    if (!tx) return;
    if (/^H[1-4]$/.test(el.tagName)) {
      if (tx === title && !secs.length) return;
      if (secs.length < 40) { cur = { title: tx.slice(0, 100), content: '' }; secs.push(cur); }
    } else {
      if (!cur) { cur = { title: 'Introduction', content: '' }; secs.push(cur); }
      if (cur.content.length < 20000) cur.content += (cur.content ? '\n' : '') + tx;
    }
  });
  if (!secs.length) return parseStudyText(docp.body.textContent, fileName);
  const all = docp.body.textContent || '';
  return {
    title,
    language: detectLanguage(all),
    topics: secs.filter(x => x.title || x.content).map(x => ({ title: x.title, content: x.content, verses: versesIn(x.title + ' ' + x.content) }))
  };
}
