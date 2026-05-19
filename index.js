require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

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
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const segments = parseSrt(text);
  const isSrt = segments.length > 0;
  const claudeInput = isSrt
    ? segments.map(s => `${s.num}|${s.startTime}|${s.text}`).join('\n')
    : text;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `להלן ${isSrt ? 'כתוביות SRT בפורמט: מספר|זמן|טקסט' : 'טקסט'} של שיעור תנ"ך.

החזר JSON בלבד — ללא הסבר, ללא markdown.

פורמט:
{"verses":[{"verse":"ספר פרק:פסוק","book":"שם הספר","chapterNum":45,"verseNum":15,"subtitleNum":4,"srtExcerpt":"ציטוט ממשי מהטקסט","verseText":"נוסח הפסוק המלא"}]}

כללים:
1. זהה פסוק רק אם מילות הפסוק עצמו מצוטטות בטקסט — לא הסבר, לא פרפרזה, לא תרגום
2. סדר המיפוי חייב להיות עקבי: ככל שמספר הכתובית עולה, chapterNum ו-verseNum חייבים לעלות גם הם. זיהוי שובר את הסדר — פסול
3. החזר רק פסוקים שזוהו — אל תכלול פסוקים חסרים

${isSrt ? 'כתוביות' : 'טקסט'}:
${claudeInput}`,
      }],
    });

    const rawText = response.content.find(b => b.type === 'text')?.text ?? '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'תשובה לא תקינה מקלוד', raw: rawText });

    const parsed = JSON.parse(jsonMatch[0]);
    const segmentMap = new Map(segments.map(s => [s.num, s.startTime]));

    const detectedVerses = (parsed.verses || []).map(v => {
      const startRaw = v.subtitleNum ? segmentMap.get(v.subtitleNum) : undefined;
      const verseHeb = v.book && v.chapterNum && v.verseNum
        ? `${v.book} ${numToHebrew(v.chapterNum)}:${numToHebrew(v.verseNum)}`
        : v.verse;
      return { ...v, verse: verseHeb, startTime: startRaw ? startRaw.split(',')[0] : undefined };
    });

    const { verses, complete } = detectGaps(detectedVerses);
    res.json({ verses, complete });
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

app.listen(PORT, () => {
  console.log(`Ivrit server running on port ${PORT}`);
});
