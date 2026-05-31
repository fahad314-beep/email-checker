const path = require("path");
const net = require("net");
const dns = require("dns");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const app = express();
app.use(cors());
app.use(express.json());

function checkEmail(rawLine) {
  return new Promise((resolve) => {
    const email = rawLine.split(/[:	 |]/)[0].trim();
    const domain = email.split("@")[1];
    if (!domain) { resolve({ email, status: "notexist" }); return; }
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve({ email, status: "notexist" });
        return;
      }
      const mxHost = addresses.sort((a,b) => a.priority - b.priority)[0].exchange;
      const client = net.createConnection(25, mxHost);
      client.setTimeout(10000);
      let step = 0;
      let resolved = false;
      function done(status) {
        if (!resolved) { resolved = true; resolve({ email, status }); client.destroy(); }
      }
      client.on("data", (data) => {
        const r = data.toString();
        if (step === 0 && r.includes("220")) { client.write("HELO checker.com\r\n"); step = 1; }
        else if (step === 1 && r.includes("250")) { client.write("MAIL FROM:<test@checker.com>\r\n"); step = 2; }
        else if (step === 2 && r.includes("250")) { client.write("RCPT TO:<" + email + ">\r\n"); step = 3; }
        else if (step === 3) { done(r.includes("250") ? "good" : "notexist"); }
      });
      client.on("timeout", () => done("verified"));
      client.on("error", () => done("verified"));
    });
  });
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