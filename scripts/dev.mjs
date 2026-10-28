import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiProject = path.join(root, 'backend', 'StructStock.Api', 'StructStock.Api.csproj');

const children = [];

function start(command, args, name) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
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

start('dotnet', ['run', '--project', apiProject, '--urls', 'http://localhost:5080'], 'api');
start('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], 'vite');

process.on('SIGINT', () => {
  for (const child of children) child.kill();
  process.exit(0);
});
