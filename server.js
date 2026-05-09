const https = require('https');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

function checkEmail(email) {
  return new Promise((resolve) => {
    const url = `https://mail.google.com/mail/gxlu?email=${encodeURIComponent(email)}`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    }, (res) => {
      const status = res.statusCode;
      if (status === 204) {
        resolve({ email, status: 'good' });
      } else if (status === 404) {
        resolve({ email, status: 'dead' });
      } else {
        resolve({ email, status: 'unknown' });
      }
    });
    req.setTimeout(8000, () => {
      resolve({ email, status: 'timeout' });
      req.destroy();
    });
    req.on('error', () => {
      resolve({ email, status: 'error' });
    });
  });
}

app.post('/check', async (req, res) => {
  const { emails } = req.body;
  if (!emails || !Array.isArray(emails)) {
    return res.status(400).json({ error: 'emails array required' });
  }
  const results = await Promise.all(emails.map(checkEmail));
  res.json(results);
});

app.get('/', (req, res) => {
  res.json({ status: 'Gmail Checker API running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});