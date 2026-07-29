const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'data', 'sefaria-cache.json');
const USE_CACHE = false; // בוטל זמנית

const sefariaClient = axios.create({
  baseURL: 'https://www.sefaria.org/api',
  timeout: 10000,
});

let cache = {};
if (USE_CACHE && fs.existsSync(CACHE_FILE)) {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
}

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

async function sefariaGet(urlPath) {
  if (USE_CACHE && cache[urlPath]) return cache[urlPath];
  const res = await sefariaClient.get(urlPath);
  if (USE_CACHE) {
    cache[urlPath] = res.data;
    saveCache();
  }
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

// מספר עברי בפורמט תצוגה: אות בודדת מקבלת גרש (א׳), כמה אותיות מקבלות גרשיים לפני האחרונה (ט״ו)
function hebrewNumeral(n) {
  if (n === 15) return 'ט״ו';
  if (n === 16) return 'ט״ז';
  const vals = [[400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],[90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],[40,'מ'],[30,'ל'],[20,'כ'],[10,'י'],[9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],[4,'ד'],[3,'ג'],[2,'ב'],[1,'א']];
  let letters = '';
  for (const [val, ch] of vals) { while (n >= val) { letters += ch; n -= val; } }
  return letters.length <= 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

// שולף פרק שלם בבקשה אחת - התשובה של ספריא מכילה ממילא את כל הפרק גם כשמבקשים פסוק בודד,
// אז עדיף לבקש את הפרק פעם אחת ולשלוף ממנו מקומית את כל הפסוקים הדרושים
async function getChapter(bookEn, chapterNum) {
  const data = await sefariaGet(`/texts/${bookEn}.${chapterNum}`);
  const heRef = data.heRef ?? null;
  const heVerses = Array.isArray(data.he) ? data.he.map(stripHtml) : [];
  return { heRef, heVerses };
}

function verseFromChapter(chapterData, verseNum) {
  const heRef = chapterData.heRef ? `${chapterData.heRef}:${hebrewNumeral(verseNum)}` : null;
  return { heRef, verseText: chapterData.heVerses[verseNum - 1] ?? null };
}

// כל פירוש (שטיינזלץ/רש"י/מלבי"ם/...) מאונדקס בספריא כטקסט רגיל (לא רק כ"קישור"),
// בפורמט ref קבוע "{Commentator}_on_{Book}" - עם context=0 מקבלים בדיוק את הפסוק
// המבוקש (לא פרק שלם), מתאים לשליפה על-פי דרישה של פסוק בודד
async function getCommentary(bookEn, chapterNum, verseNum, commentatorPrefix) {
  const data = await sefariaGet(`/texts/${commentatorPrefix}_on_${bookEn}.${chapterNum}.${verseNum}?context=0`);
  const heRef = data.heRef ?? null;
  // חלק מהפרשנים (כמו רש"י/מלבי"ם) מחזירים כמה הערות נפרדות לאותו פסוק כמערך, גם ב-context=0 -
  // בניגוד לשטיינזלץ שמחזיר מחרוזת בודדת. מאחדים את שני המקרים לטקסט אחד.
  const heParts = Array.isArray(data.he) ? data.he : (typeof data.he === 'string' ? [data.he] : []);
  const text = heParts.map(stripHtml).filter(Boolean).join(' ') || null;
  return { heRef, text };
}

// רשימת הפרשנים שקיימים בפועל בספריא לפסוק הזה (לא רשימה קבועה מראש) - "links" מחזיר גם
// מדרש/תלמוד/מאמרים וכו', מסננים לקטגוריית Commentary בלבד. collectiveTitle.en (עם רווחים
// מוחלפים ב-קו תחתון) הוא בדיוק ה-prefix שמשמש את /texts/{prefix}_on_{Book}...
async function getCommentatorsList(bookEn, chapterNum, verseNum) {
  const data = await sefariaGet(`/links/${bookEn}.${chapterNum}.${verseNum}?with_text=0`);
  const seen = new Map();
  for (const item of Array.isArray(data) ? data : []) {
    if (item.category !== 'Commentary') continue;
    const en = item.collectiveTitle && item.collectiveTitle.en;
    if (!en || seen.has(en)) continue;
    const he = item.collectiveTitle && item.collectiveTitle.he;
    seen.set(en, { prefix: en.replace(/\s+/g, '_'), label: he || en });
  }
  return [...seen.values()];
}

module.exports = { sefariaGet, getChapter, verseFromChapter, getCommentary, getCommentatorsList };
