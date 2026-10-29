import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiProject = path.join(root, 'backend', 'StructStock.Api', 'StructStock.Api.csproj');

const children = [];

function quote(arg) {
  // Windows shell splits on spaces unless the path is quoted.
  if (process.platform === 'win32' && /[\s"]/.test(arg)) {
    return `"${arg.replaceAll('"', '\\"')}"`;
  }
  return arg;
}

function start(command, args, name) {
  const child = spawn(command, args.map(quote), {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development' },
  });
  child.on('exit', (code) => {
    console.log(`[dev] ${name} exited with code ${code}`);
    for (const other of children) {
      if (other !== child && !other.killed) other.kill();
    }
    process.exit(code ?? 1);
  });
  children.push(child);
}

// Bind API to IPv4 loopback so Vite proxy (127.0.0.1:5080) never hits ::1.
start('dotnet', ['run', '--project', apiProject, '--urls', 'http://127.0.0.1:5080'], 'api');
start('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], 'vite');

process.on('SIGINT', () => {
  for (const child of children) child.kill();
  process.exit(0);
});
