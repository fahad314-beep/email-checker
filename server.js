const path = require("path");
const https = require("https");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const app = express();
app.use(cors());
app.use(express.json());

const proxies = [
  {host:"38.154.203.95",port:5863,user:"xxxxpplb",pass:"glz35o94icq2"},
  {host:"198.105.121.200",port:6462,user:"xxxxpplb",pass:"glz35o94icq2"},
  {host:"64.137.96.74",port:6641,user:"xxxxpplb",pass:"glz35o94icq2"},
  {host:"209.127.138.10",port:5784,user:"xxxxpplb",pass:"glz35o94icq2"},
  {host:"38.154.185.97",port:6370,user:"xxxxpplb",pass:"glz35o94icq2"},
  {host:"84.247.60.125",port:6095,user:"xxxxpplb",pass:"glz35o94icq2"},
  {host:"142.111.67.146",port:5611,user:"xxxxpplb",pass:"glz35o94icq2"},
  {host:"191.96.254.138",port:6185,user:"xxxxpplb",pass:"glz35o94icq2"},
  {host:"31.58.9.4",port:6077,user:"xxxxpplb",pass:"glz35o94icq2"},
  {host:"64.137.10.153",port:5803,user:"xxxxpplb",pass:"glz35o94icq2"}
];
let pi = 0;

function checkEmail(email) {
  return new Promise((resolve) => {
    const p = proxies[pi++ % proxies.length];
    const auth = Buffer.from(p.user + ":" + p.pass).toString("base64");
    const url = "https://mail.google.com/mail/gxlu?email=" + encodeURIComponent(email);
    
    const tunnel = require("net").createConnection(p.port, p.host);
    tunnel.on("connect", () => {
      tunnel.write("CONNECT mail.google.com:443 HTTP/1.1\r\nHost: mail.google.com:443\r\nProxy-Authorization: Basic " + auth + "\r\n\r\n");
    });
    tunnel.on("data", (data) => {
      if (data.toString().includes("200")) {
        const tlsSocket = require("tls").connect({socket: tunnel, servername: "mail.google.com"}, () => {
          tlsSocket.write("GET /mail/gxlu?email=" + encodeURIComponent(email) + " HTTP/1.1\r\nHost: mail.google.com\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n");
        });
        tlsSocket.on("data", (d) => {
          const res = d.toString();
          const status = parseInt((res.match(/HTTP\/1\.[01] (\d+)/) || [])[1]);
          console.log(email + " -> " + status + " [" + p.host + "]");
          if (status === 204) resolve({ email, status: "good" });
          else if (status === 404) resolve({ email, status: "notexist" });
          else resolve({ email, status: "verified" });
          tunnel.destroy();
        });
        tlsSocket.on("error", () => { resolve({ email, status: "notexist" }); tunnel.destroy(); });
      } else {
        resolve({ email, status: "notexist" });
        tunnel.destroy();
      }
    });
    tunnel.setTimeout(10000, () => { resolve({ email, status: "verified" }); tunnel.destroy(); });
    tunnel.on("error", () => resolve({ email, status: "notexist" }));
  });
}

app.post("/check", async (req, res) => {
  const { emails } = req.body;
  if (!emails || !Array.isArray(emails)) return res.status(400).json({ error: "emails array required" });
  const parsed = emails.map(line => {
    const parts = line.split(/[:|\t ]/).map(p => p.trim());
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