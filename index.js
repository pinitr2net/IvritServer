require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = process.env.ENDPOINT_ID;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

const jobFiles = new Map();

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

app.listen(PORT, () => {
  console.log(`Ivrit server running on port ${PORT}`);
});
