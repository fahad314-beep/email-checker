const path = require("path");
const net = require("net");
const dns = require("dns");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const app = express();
app.use(cors({origin: "*"}));
app.use(express.json());

async function checkEmail(email) {
  try {
    const res = await fetch('https://mail.google.com/mail/gxlu?email=' + encodeURIComponent(email), {
      method: 'GET', headers: {'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0'}, redirect: 'manual'
    });
    if (res.status === 204) return { email, status: 'good' };
    if (res.status === 404) return { email, status: 'notexist' };
    return { email, status: 'verified' };
  } catch(e) { return { email, status: 'verified' }; }
}

app.post("/check", async (req, res) => {
  const { emails } = req.body;
  if (!emails || !Array.isArray(emails)) return res.status(400).json({ error: "emails array required" });
  const parsed = emails.map(line => {
    const parts = line.split(/[:	 ]/).map(p => p.trim());
    return { email: parts[0], password: parts[1] || "" };
  });
  const results = await Promise.all(parsed.map(({ email, password }) =>
    checkEmail(email).then(r => ({ ...r, password }))
  ));
  const lines = results.map(r => r.email + (r.password ? ":" + r.password : "") + " [" + r.status + "]").join("\n") + "\n";
  try { fs.appendFileSync("checked_results.txt", lines); } catch(e) {}
  res.json(results);
});

app.get("/results", (req, res) => {
  try { res.setHeader("Content-Type","text/plain"); res.send(fs.readFileSync("checked_results.txt","utf8")); }
  catch(e) { res.send("No results yet."); }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));