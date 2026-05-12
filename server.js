const path = require("path");
const https = require('https');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(require('express').static(__dirname));

function checkEmail(email, password) {
  return new Promise((resolve) => {
    const url = `https://mail.google.com/mail/gxlu?email=${encodeURIComponent(email)}`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    }, (res) => {
      const status = res.statusCode;
      if (status === 204) {
        resolve({ email, password, status: 'good' });
      } else if (status === 404) {
        resolve({ email, password, status: 'notexist' });
      } else {
        resolve({ email, password, status: 'unknown' });
      }
    });
    req.setTimeout(8000, () => {
      resolve({ email, password, status: 'verified' });
      req.destroy();
    });
    req.on('error', () => {
      resolve({ email, password, status: 'notexist' });
    });
  });
}

app.post('/check', async (req, res) => {
  const { emails } = req.body;
  if (!emails || !Array.isArray(emails)) {
    return res.status(400).json({ error: 'emails array required' });
  }
  
  const parsed = emails.map(line => {
    const parts = line.split(/[:	 ]/).map(p => p.trim());
    return { email: parts[0], password: parts[1] || '' };
  });

  const results = await Promise.all(parsed.map(({ email, password }) => checkEmail(email, password)));
  
  // Save good results to file
  const goodResults = results.filter(r => r.status === 'good' && r.password);
  if (goodResults.length > 0) {
    const fs = require('fs');
    const lines = goodResults.map(r => r.email + ':' + r.password).join('
') + '
';
    fs.appendFileSync('good_results.txt', lines);
  }
  
  res.json(results);
});
  }
  const results = await Promise.all(emails.map(checkEmail));
  res.json(results);
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});