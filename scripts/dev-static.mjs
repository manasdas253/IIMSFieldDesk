import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const vite = resolve(root, "node_modules/vite/bin/vite.js");
const port = process.env.PORT || "3000";

const child = spawn(
  process.execPath,
  [vite, "--host", "0.0.0.0", "--port", port, "--strictPort"],
  { cwd: root, env: process.env, stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
