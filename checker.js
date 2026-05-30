const net = require('net');
const dns = require('dns');
const fs = require('fs');

function checkEmail(email) {
  return new Promise((resolve) => {
    const domain = email.split('@')[1];
    
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve({ email: cleanEmail, status: '❌ Not Exit' });
        return;
      }
      
      const mxHost = addresses[0].exchange;
      const client = net.createConnection(25, mxHost);
      
      client.setTimeout(8000);
      
      let step = 0;
      
      client.on('data', (data) => {
        const response = data.toString();
        
        if (step === 0 && response.includes('220')) {
          client.write('HELO checker.com\r\n');
          step = 1;
        } else if (step === 1 && response.includes('250')) {
          client.write('MAIL FROM:<test@checker.com>\r\n');
          step = 2;
        } else if (step === 2 && response.includes('250')) {
          client.write(`RCPT TO:<${email}>\r\n`);
          step = 3;
        } else if (step === 3) {
          if (response.includes('250')) {
            resolve({ email: cleanEmail, status: '✅ Good' });
          } else {
            resolve({ email: cleanEmail, status: '❌ Not Exit' });
          }
          client.destroy();
        }
      });
      
      client.on('timeout', () => {
        resolve({ email: cleanEmail, status: '⚠️ Verified' });
        client.destroy();
      });
      
      client.on('error', () => {
        resolve({ email: cleanEmail, status: '❌ Not Exit' });
      });
    });
  });
}

const emails = fs.readFileSync('emails.txt', 'utf8')
  .split('\n')
  .map(e => e.trim())
  .filter(e => e.length > 0);

async function runCheck() {
  console.log('🚀 Checking ' + emails.length + ' emails...\n');
  const start = Date.now();
  const results = await Promise.all(emails.map(checkEmail));
  const end = Date.now();
  results.forEach(r => console.log(`${r.status} - ${r.email}`));
  console.log('\n⏱️ Time: ' + ((end-start)/1000).toFixed(2) + ' seconds');
  console.log('✅ Good: ' + results.filter(r => r.status.includes('Good')).length);
  console.log('⚠️ Verified: ' + results.filter(r => r.status.includes('Verified')).length);
  console.log('❌ Not Exit: ' + results.filter(r => r.status.includes('Not Exit')).length);
}

runCheck();