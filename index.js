require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { sefariaGet, getVerse } = require('./sefaria');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const LECTURES_DIR = path.join(__dirname, 'lectures');
const LECTURE_SLUG_RE = /^[a-zA-Z0-9_-]+$/;
const AUDIO_EXTS = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac', '.opus', '.wma', '.mp4', '.mov', '.avi', '.mkv', '.webm'];
const AUDIO_MIME_TYPES = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.aac': 'audio/aac',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.opus': 'audio/opus', '.wma': 'audio/x-ms-wma',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = process.env.ENDPOINT_ID;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

const jobFiles = new Map();

function numToHebrew(n) {
  if (n === 15) return 'טו';
  if (n === 16) return 'טז';
  const vals = [[400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],[90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],[40,'מ'],[30,'ל'],[20,'כ'],[10,'י'],[9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],[4,'ד'],[3,'ג'],[2,'ב'],[1,'א']];
  let result = '';
  for (const [val, ch] of vals) { while (n >= val) { result += ch; n -= val; } }
  return result;
}

function hebrewToNum(str) {
  const vals = { 'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,
    'כ':20,'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,'ס':60,'ע':70,'פ':80,'ף':80,
    'צ':90,'ץ':90,'ק':100,'ר':200,'ש':300,'ת':400 };
  let sum = 0;
  for (const ch of str) { if (vals[ch]) sum += vals[ch]; }
  return sum;
}

function resolveLectureFiles(slug) {
  const dir = path.join(LECTURES_DIR, slug);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const has = name => files.includes(name);
  const pick = candidates => candidates.find(has);

  const captionsFile = pick([`${slug}.corrected.srt`, `${slug}.srt`, `${slug}.verses.srt`]);
  const refsFile = has(`${slug}.refs.srt`) ? `${slug}.refs.srt` : null;
  const chaptersFile = has(`${slug}.chapters.srt`) ? `${slug}.chapters.srt` : null;
  const metaFile = has(`${slug}.meta.json`) ? `${slug}.meta.json` : null;
  const audioFile = files.find(f => f.startsWith(`${slug}.`) && AUDIO_EXTS.includes(path.extname(f).toLowerCase()));

  if (!captionsFile || !refsFile || !metaFile || !audioFile) return null;

  const meta = JSON.parse(fs.readFileSync(path.join(dir, metaFile), 'utf8'));

  return {
    book: meta.book,
    title: meta.title || null,
    audioPath: path.join(dir, audioFile),
    captionsPath: path.join(dir, captionsFile),
    refsPath: path.join(dir, refsFile),
    chaptersPath: chaptersFile ? path.join(dir, chaptersFile) : null,
  };
}

function detectGaps(detectedVerses) {
  if (!detectedVerses.length) return { verses: [], complete: true };
  const sorted = [...detectedVerses].sort((a, b) =>
    a.chapterNum !== b.chapterNum ? a.chapterNum - b.chapterNum : a.verseNum - b.verseNum
  );
  const book = sorted[0].book || '';
  const result = [];
  let complete = true;

  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i === sorted.length - 1) break;
    const curr = sorted[i], next = sorted[i + 1];
    if (curr.chapterNum === next.chapterNum) {
      for (let v = curr.verseNum + 1; v < next.verseNum; v++) {
        result.push({ verse: `${book} ${numToHebrew(curr.chapterNum)}:${numToHebrew(v)}`, missing: true });
        complete = false;
      }
    } else {
      for (let v = 1; v < next.verseNum; v++) {
        result.push({ verse: `${book} ${numToHebrew(next.chapterNum)}:${numToHebrew(v)}`, missing: true });
        complete = false;
      }
    }
  }
  return { verses: result, complete };
}

function parseSrt(srt) {
  const blocks = srt.trim().split(/\n\s*\n/);
  return blocks.map(block => {
    const lines = block.trim().split('\n');
    const num = parseInt(lines[0]);
    const times = lines[1] || '';
    const [startTime] = times.split(' --> ');
    const text = lines.slice(2).join(' ');
    return { num, startTime: startTime?.trim(), text };
  }).filter(b => b.num && b.startTime);
}

app.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

  const ext = path.extname(req.file.originalname) || '.mp3';
  const filename = crypto.randomUUID() + ext;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, req.file.buffer);

  const fileUrl = `${BASE_URL}/uploads/${filename}`;
  console.log('Sending audio URL:', fileUrl);

  try {
    const runpodRes = await axios.post(
      `https://api.runpod.ai/v2/${ENDPOINT_ID}/run`,
      {
        input: {
          model: 'ivrit-ai/whisper-large-v3-turbo-ct2',
          transcribe_args: {
            url: fileUrl,
            language: 'he',
            verbose: false,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${RUNPOD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const jobId = runpodRes.data?.id;
    if (!jobId) {
      fs.unlink(filepath, () => {});
      return res.status(500).json({ error: 'No job ID from RunPod', raw: runpodRes.data });
    }

    jobFiles.set(jobId, filepath);
    res.json({ jobId });
  } catch (err) {
    fs.unlink(filepath, () => {});
    console.error('Error submitting job:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});

app.get('/status/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    const statusRes = await axios.get(
      `https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`,
      {
        headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
        timeout: 15000,
      }
    );

    const data = statusRes.data;
    console.log('RunPod status:', data.status);

    if (data.status === 'FAILED') {
      fs.unlink(jobFiles.get(jobId) || '', () => {});
      jobFiles.delete(jobId);
      return res.status(500).json({ error: data.error || 'RunPod job failed' });
    }

    if (data.status !== 'COMPLETED') {
      return res.json({ status: data.status });
    }

    fs.unlink(jobFiles.get(jobId) || '', () => {});
    jobFiles.delete(jobId);

    const output = data.output;
    const parsed = typeof output === 'string' ? JSON.parse(output) : output;
    const segments = parsed?.[0]?.result?.flat() ?? [];
    const text = segments.length > 0
      ? segments.map(s => s.text).join('')
      : JSON.stringify(parsed);

    const srt = segments.map((s, i) => {
      const fmt = sec => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s2 = Math.floor(sec % 60);
        const ms = Math.round((sec % 1) * 1000);
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s2).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
      };
      return `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text.trim()}\n`;
    }).join('\n');

    res.json({ status: 'COMPLETED', text, srt });
  } catch (err) {
    console.error('Error polling status:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});

app.post('/find-verses', express.json(), async (req, res) => {
  const { text, includeTopics = false } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const segments = parseSrt(text);
  const isSrt = segments.length > 0;
  const claudeInput = isSrt
    ? segments.map(s => `${s.num}|${s.startTime}|${s.text}`).join('\n')
    : text;

  const topicsFormat = includeTopics
    ? `{"verses":[{"book":"Genesis","chapterNum":45,"verseNum":15,"subtitleNum":4,"srtExcerpt":"ציטוט ממשי מהטקסט"}],"topics":[{"title":"כותרת נושא בעברית","subtitleNum":1}]}`
    : `{"verses":[{"book":"Genesis","chapterNum":45,"verseNum":15,"subtitleNum":4,"srtExcerpt":"ציטוט ממשי מהטקסט"}]}`;

  const topicsInstructions = includeTopics
    ? `\n5. נושאים: חלק את השיעור ל-3–8 נושאים עיקריים לפי תוכן. כל נושא — כותרת קצרה בעברית ו-subtitleNum של הכתובית שבה מתחיל הנושא. נושאים בסדר כרונולוגי.`
    : '';

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: `להלן ${isSrt ? 'כתוביות SRT בפורמט: מספר|זמן|טקסט' : 'טקסט'} של שיעור תנ"ך.

החזר JSON בלבד — ללא הסבר, ללא markdown.

פורמט:
${topicsFormat}

book חייב להיות השם האנגלי כפי שספריא מצפה (Genesis, Exodus, Leviticus, Numbers, Deuteronomy, Joshua, Judges, I Samuel, II Samuel, I Kings, II Kings, Isaiah, Jeremiah, Ezekiel, Hosea, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi, Psalms, Proverbs, Job, Song of Songs, Ruth, Lamentations, Ecclesiastes, Esther, Daniel, Ezra, Nehemiah, I Chronicles, II Chronicles)

כללים:
1. זהה פסוק רק אם מילות הפסוק עצמו מצוטטות בטקסט — לא הסבר, לא פרפרזה, לא תרגום
2. סדר המיפוי חייב להיות עקבי: ככל שמספר הכתובית עולה, chapterNum ו-verseNum חייבים לעלות גם הם. זיהוי שובר את הסדר — פסול
3. החזר רק פסוקים שזוהו — אל תכלול פסוקים חסרים
4. השתמש במספור פרקים ופסוקים לפי הנוסח העברי המסורתי (מסורה) — לא לפי תרגום LXX או נוסח נוצרי${topicsInstructions}

${isSrt ? 'כתוביות' : 'טקסט'}:
${claudeInput}`,
      }],
    });

    const rawText = response.content.find(b => b.type === 'text')?.text ?? '';
    console.log('Claude stop_reason:', response.stop_reason, 'response length:', rawText.length);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'תשובה לא תקינה מקלוד', raw: rawText });

    const parsed = JSON.parse(jsonMatch[0]);
    const segmentMap = new Map(segments.map(s => [s.num, s.startTime]));

    const detectedVerses = await Promise.all((parsed.verses || []).map(async v => {
      const startRaw = v.subtitleNum ? segmentMap.get(v.subtitleNum) : undefined;
      let verse = `${v.book} ${numToHebrew(v.chapterNum)}:${numToHebrew(v.verseNum)}`;
      let verseText = null;
      if (v.book && v.chapterNum && v.verseNum) {
        try {
          const sefaria = await getVerse(v.book, v.chapterNum, v.verseNum);
          if (sefaria.heRef) verse = sefaria.heRef;
          verseText = sefaria.verseText;
        } catch (e) {
          console.warn('Sefaria lookup failed:', v.book, v.chapterNum, v.verseNum, e.message);
        }
      }
      return { ...v, verse, verseText, startTime: startRaw ? startRaw.split(',')[0] : undefined };
    }));

    const seen = new Set();
    const uniqueVerses = detectedVerses.filter(v => {
      const key = `${v.chapterNum}:${v.verseNum}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const { verses, complete } = detectGaps(uniqueVerses);

    const topics = includeTopics
      ? (parsed.topics || []).map(t => ({
          title: t.title,
          subtitleNum: t.subtitleNum,
          startTime: t.subtitleNum ? segmentMap.get(t.subtitleNum)?.split(',')[0] : undefined,
        }))
      : undefined;

    res.json({ verses, complete, ...(topics !== undefined && { topics }), claudeRaw: jsonMatch[0] });
  } catch (err) {
    console.error('find-verses error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/claude', express.json(), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{ role: 'user', content: text }],
    });
    const result = response.content.find(b => b.type === 'text')?.text ?? '';
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/lectures/list', (req, res) => {
  const entries = fs.readdirSync(LECTURES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && LECTURE_SLUG_RE.test(e.name))
    .map(e => e.name)
    .sort();

  const lectures = entries
    .map(slug => ({ slug, lecture: resolveLectureFiles(slug) }))
    .filter(({ lecture }) => lecture)
    .map(({ slug, lecture }) => ({ slug, title: lecture.title || slug, url: `${BASE_URL}/lecture/${slug}` }));

  const items = lectures
    .map(({ slug, title, url }) => `<li><a href="${url}">${title}</a> <span class="slug">(${slug})</span></li>`)
    .join('\n');

  res.send(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>רשימת שיעורים</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
  li { margin: 0.6rem 0; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .slug { color: #888; font-size: 0.85em; }
</style>
</head>
<body>
<h1>שיעורים זמינים</h1>
<ul>
${items}
</ul>
</body>
</html>`);
});

app.get('/lecture/debug/:slug', (req, res) => {
  if (!LECTURE_SLUG_RE.test(req.params.slug)) return res.status(404).send('Not found');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/lecture/:slug', (req, res) => {
  if (!LECTURE_SLUG_RE.test(req.params.slug)) return res.status(404).send('Not found');
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const loaderStyle = '<style>#lectureLoader{display:flex}.card,#viewToggleFab,#userView{display:none}</style>';
  res.send(html.replace('</head>', `${loaderStyle}</head>`));
});

app.get('/lecture/:slug/audio', (req, res) => {
  const { slug } = req.params;
  if (!LECTURE_SLUG_RE.test(slug)) return res.status(404).json({ error: 'Not found' });
  const lecture = resolveLectureFiles(slug);
  if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

  const contentType = AUDIO_MIME_TYPES[path.extname(lecture.audioPath).toLowerCase()] || 'application/octet-stream';
  const fileSize = fs.statSync(lecture.audioPath).size;
  const range = req.headers.range;

  // Range מטופל כאן באופן ידני (בלי ETag/Last-Modified) כדי למנוע באג ידוע ב-Safari/iOS,
  // שבו קאש הדפדפן משחזר תגובה שמורה מבייט 0 במקום לכבד Range חדש בבקשת seek.
  if (!range) {
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': fileSize, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(lecture.audioPath).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
  if (start >= fileSize || end >= fileSize || start > end) {
    return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
  }

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1,
    'Content-Type': contentType,
  });
  fs.createReadStream(lecture.audioPath, { start, end }).pipe(res);
});

app.get('/lecture/:slug/data.json', async (req, res) => {
  const { slug } = req.params;
  if (!LECTURE_SLUG_RE.test(slug)) return res.status(404).json({ error: 'Not found' });
  const lecture = resolveLectureFiles(slug);
  if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

  try {
    const refsSrt = fs.readFileSync(lecture.refsPath, 'utf8');
    const refBlocks = parseSrt(refsSrt);

    const detectedVerses = await Promise.all(refBlocks.map(async block => {
      const [chapterHeb, verseHeb] = block.text.split(',').map(s => s.trim());
      const chapterNum = hebrewToNum(chapterHeb);
      const verseNum = hebrewToNum(verseHeb);
      const startTime = block.startTime.split(',')[0];
      let verse = `${lecture.book} ${numToHebrew(chapterNum)}:${numToHebrew(verseNum)}`;
      let verseText = null;
      try {
        const sefaria = await getVerse(lecture.book, chapterNum, verseNum);
        if (sefaria.heRef) verse = sefaria.heRef;
        verseText = sefaria.verseText;
      } catch (e) {
        console.warn('Sefaria lookup failed:', lecture.book, chapterNum, verseNum, e.message);
      }
      return { book: lecture.book, chapterNum, verseNum, verse, verseText, startTime };
    }));

    const { verses, complete } = detectGaps(detectedVerses);

    let topics;
    if (lecture.chaptersPath) {
      const chaptersSrt = fs.readFileSync(lecture.chaptersPath, 'utf8');
      topics = parseSrt(chaptersSrt).map(b => ({ title: b.text, startTime: b.startTime.split(',')[0] }));
    }

    const srt = fs.readFileSync(lecture.captionsPath, 'utf8');

    res.json({ book: lecture.book, title: lecture.title, audioUrl: `/lecture/${slug}/audio`, srt, verses, complete });
  } catch (err) {
    console.error('lecture data error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ivrit server running on port ${PORT}`);
});
