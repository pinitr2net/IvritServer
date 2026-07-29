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
// בפורמט ref קבוע "{Commentator}_on_{Book}". בקשת טווח "min-max" *אמורה* להחזיר isSpanning:true
// עם he כמערך מקונן פר-פסוק - אבל זה נכון רק לפרשנים "מורכבים" (כמה הערות לפסוק, כמו רש"י).
// לפרשנים "פשוטים" (הערה אחת לפסוק, כמו שטיינזלץ) ספריא תמיד עונה isSpanning:false ומחזירה
// את **כל הפרק** (מפסוק א') בלי קשר לטווח שביקשנו בכלל - isSpanning לא מבחין בין שני המצבים!
// הסימן האמין: sectionRef. "X on Book N" (בלי נקודתיים) = כל הפרק חזר, he[i] הוא פסוק i+1.
// "X on Book N:M" (עם נקודתיים) = פסוק/טווח אמיתי - כאן isSpanning כן אמין להבחין טווח מפסוק בודד.
async function getCommentaryRange(bookEn, chapterNum, minVerse, maxVerse, commentatorPrefix) {
  const data = await sefariaGet(`/texts/${commentatorPrefix}_on_${bookEn}.${chapterNum}.${minVerse}-${maxVerse}`);
  const byVerse = new Map();
  const toText = parts => (Array.isArray(parts) ? parts : (typeof parts === 'string' ? [parts] : []))
    .map(stripHtml).filter(Boolean).join(' ') || null;
  const heArr = Array.isArray(data.he) ? data.he : [];
  if (!/:/.test(data.sectionRef || '')) {
    // נפל חזרה לכל הפרק (פרשן "פשוט") - he[i] הוא פסוק i+1 מתחילת הפרק, לא מתחילת minVerse
    heArr.forEach((el, i) => byVerse.set(i + 1, toText(el)));
    return byVerse;
  }
  if (data.isSpanning) {
    heArr.forEach((el, i) => byVerse.set(minVerse + i, toText(el)));
    return byVerse;
  }
  // טווח קורס לפסוק בודד אחד (min===max) - כל he שייך לאותו פסוק יחיד, לא מחולק פר-פסוק
  byVerse.set(minVerse, toText(data.he));
  return byVerse;
}

// רשימת הפרשנים שקיימים בפועל בספריא לכל פסוק בטווח (לא רשימה קבועה מראש) - "links" מחזיר גם
// מדרש/תלמוד/מאמרים וכו', מסננים לקטגוריית Commentary בלבד. collectiveTitle.en (עם רווחים
// מוחלפים ב-קו תחתון) הוא בדיוק ה-prefix שמשמש את /texts/{prefix}_on_{Book}... בקשה אחת לכל
// הטווח (למשל כל הפרק שהשיעור מכסה) במקום בקשה נפרדת לכל פסוק.
async function getCommentatorsByVerseRange(bookEn, chapterNum, minVerse, maxVerse) {
  const data = await sefariaGet(`/links/${bookEn}.${chapterNum}.${minVerse}-${maxVerse}?with_text=0`);
  const byVerse = new Map(); // verseNum -> [{prefix,label}]
  const seenPerVerse = new Map(); // verseNum -> Set(prefix) למניעת כפילויות
  for (const item of Array.isArray(data) ? data : []) {
    if (item.category !== 'Commentary') continue;
    const verseNum = item.anchorVerse;
    const en = item.collectiveTitle && item.collectiveTitle.en;
    if (!verseNum || !en) continue;
    if (!seenPerVerse.has(verseNum)) { byVerse.set(verseNum, []); seenPerVerse.set(verseNum, new Set()); }
    const seen = seenPerVerse.get(verseNum);
    if (seen.has(en)) continue;
    seen.add(en);
    const he = item.collectiveTitle && item.collectiveTitle.he;
    byVerse.get(verseNum).push({ prefix: en.replace(/\s+/g, '_'), label: he || en });
  }
  return byVerse;
}

module.exports = { sefariaGet, getChapter, verseFromChapter, getCommentaryRange, getCommentatorsByVerseRange };
