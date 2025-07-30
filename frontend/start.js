const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const https = require('https');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
const ip = getLocalIP();
process.env.HOST_IP = ip; // 백엔드에서 쓸 수 있도록 설정
const options = {
  key: fs.readFileSync('./ssl/localhost.key'),
  cert: fs.readFileSync('./ssl/localhost.crt')
};
console.log(`:아이폰: 접속 주소: https://${ip}:3000`);
console.log(`:인터넷 : 백엔드 주소: https://${ip}:5000`);
const backend = spawn('node', ['backend/index.js'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, HOST_IP: ip },
});
const frontend = spawn('npm', ['start'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, HOST: ip },
});









