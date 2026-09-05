const http = require('http');
const { spawn } = require('child_process');

const port = Number(process.env.PORT || 5001);

const startNodemon = () => {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(command, ['nodemon', 'server.js'], {
    stdio: 'inherit',
    shell: false
  });

  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
};

const request = http.get({ host: '127.0.0.1', port, path: '/' }, (response) => {
  response.resume();
  console.log(`Backend is already running on http://localhost:${port}.`);
  process.exitCode = 0;
});

request.on('error', (error) => {
  if (error.code === 'ECONNREFUSED') {
    startNodemon();
    return;
  }

  console.error(`Could not check backend port ${port}: ${error.message}`);
  process.exitCode = 1;
});