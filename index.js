require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = process.env.ENDPOINT_ID;

app.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const ext = path.extname(req.file.originalname) || '.mp3';
  const filename = crypto.randomUUID() + ext;
  const filepath = path.join(UPLOADS_DIR, filename);

  try {
    fs.writeFileSync(filepath, req.file.buffer);

    const audioBase64 = req.file.buffer.toString('base64');
    console.log('Sending audio as base64, size:', audioBase64.length);

    const runpodRes = await axios.post(
      `https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`,
      {
        input: {
          model: 'ivrit-ai/whisper-large-v3-turbo-ct2',
          transcribe_args: {
            blob: audioBase64,
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
        timeout: 120000,
      }
    );

    const fullResponse = runpodRes.data;
    console.log('RunPod response:', JSON.stringify(fullResponse, null, 2));
    fs.writeFileSync('runpod-response.json', JSON.stringify(fullResponse, null, 2));

    if (fullResponse.status === 'FAILED') {
      return res.status(500).json({ error: fullResponse.error || 'RunPod job failed' });
    }

    const output = fullResponse.output;
    if (output === undefined || output === null) {
      return res.status(500).json({ error: 'No output from RunPod', raw: fullResponse });
    }

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

    res.json({ text, srt });
  } catch (err) {
    const errData = err.response?.data;
    const errMsg = err.message;
    console.error('Error:', errData || errMsg);
    fs.writeFileSync('runpod-response.json', JSON.stringify({ errData, errMsg }, null, 2));
    const status = err.response?.status || 500;
    res.status(status).json({ error: errData || errMsg });
  } finally {
    fs.unlink(filepath, () => {});
  }
});

app.listen(PORT, () => {
  console.log(`Ivrit server running on port ${PORT}`);
});
