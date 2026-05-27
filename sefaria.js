const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'data', 'sefaria-cache.json');

const sefariaClient = axios.create({
  baseURL: 'https://www.sefaria.org/api',
  timeout: 10000,
});

let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
}

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

async function sefariaGet(urlPath) {
  if (cache[urlPath]) return cache[urlPath];
  const res = await sefariaClient.get(urlPath);
  cache[urlPath] = res.data;
  saveCache();
  return res.data;
}

function stripHtml(str) {
  if (typeof str !== 'string') return null;
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&thinsp;/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/\{[פס]\}/g, '')
    .replace(/[֑-֯]/g, '')
    .trim();
}

async function getVerse(bookEn, chapter, verse) {
  const urlPath = `/texts/${bookEn}.${chapter}.${verse}`;
  const data = await sefariaGet(urlPath);
  const heRef = data.heRef ?? null;
  const he = Array.isArray(data.he) ? data.he[verse - 1] : (data.he ?? null);
  return { heRef, verseText: stripHtml(he) };
}

module.exports = { sefariaGet, getVerse };
