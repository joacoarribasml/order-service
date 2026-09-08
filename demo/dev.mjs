import { spawn } from "node:child_process";

const children = [
  spawn("npm", ["run", "dev"], { stdio: "inherit" }),
  spawn("node", ["demo/server.mjs"], { stdio: "inherit" }),
];

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code ?? 0;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

for (const child of children) {
  child.on("exit", (code) => shutdown(code ?? 0));
}
