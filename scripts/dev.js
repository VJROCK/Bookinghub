// Runs server and client dev processes together (cross-platform, no extra deps)
const { spawn } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(name, args, cwd) {
  const p = spawn(npmCmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  p.stdout.on('data', d => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', d => process.stderr.write(`[${name}] ${d}`));
  p.on('exit', c => { console.log(`[${name}] exited (${c})`); process.exit(c || 0); });
  return p;
}

run('server', ['start'], path.join(root, 'server'));
setTimeout(() => run('client', ['run', 'dev'], path.join(root, 'client')), 1200);
