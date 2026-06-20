import { spawn } from "node:child_process";

const commands = [
  ["backend", "node", ["server/index.mjs"]],
  ["frontend", "./node_modules/.bin/vite", ["--host", "0.0.0.0", "--port", "5174", "--strictPort"]],
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, { stdio: ["inherit", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with ${code}`);
    }
  });
  return child;
});

function shutdown() {
  for (const child of children) {
    child.kill("SIGINT");
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
