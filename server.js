const path = require("path");
const net = require("net");
const dns = require("dns");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const app = express();
app.use(cors());
app.use(express.json());

function checkEmail(email) {
  return new Promise((resolve) => {
    const domain = email.split("@")[1];
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve({ email, status: "notexist" });
        return;
      }
      const mxHost = addresses[0].exchange;
      const client = net.createConnection(25, mxHost);
      client.setTimeout(8000);
      let step = 0;
      client.on("data", (data) => {
        const response = data.toString();
        if (step === 0 && response.includes("220")) {
          client.write("HELO checker.com\r\n");
          step = 1;
        } else if (step === 1 && response.includes("250")) {
          client.write("MAIL FROM:<test@checker.com>\r\n");
          step = 2;
        } else if (step === 2 && response.includes("250")) {
          client.write("RCPT TO:<" + email + ">\r\n");
          step = 3;
        } else if (step === 3) {
          if (response.includes("250")) {
            resolve({ email, status: "good" });
          } else {
            resolve({ email, status: "notexist" });
          }
          client.destroy();
        }
      });
      client.on("timeout", () => {
        resolve({ email, status: "verified" });
        client.destroy();
      });
      client.on("error", () => {
        resolve({ email, status: "notexist" });
      });
    });
  });
}

app.post("/check", async (req, res) => {
  const { emails } = req.body;
  if (!emails || !Array.isArray(emails)) {
    return res.status(400).json({ error: "emails array required" });
  }
  const parsed = emails.map(line => {
    const parts = line.split(":").map(p => p.trim());
    return { email: parts[0], password: parts[1] || "" };
  });
  const results = await Promise.all(parsed.map(({ email, password }) =>
    checkEmail(email).then(r => ({ ...r, password }))
  ));
  const lines = results.map(r => r.email + (r.password ? ":" + r.password : "") + " [" + r.status + "]").join("\n") + "\n";
  fs.appendFileSync("checked_results.txt", lines);
  res.json(results);
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});