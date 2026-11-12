import "dotenv/config";
import { access, cp, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const projectDir = process.cwd();
const buildDir = path.join(projectDir, ".next");
const standaloneDir = path.join(buildDir, "standalone");
const serverPath = path.join(standaloneDir, "server.js");

try {
  await access(serverPath);
} catch {
  console.error("Production standalone build is missing. Run `npm run build` first.");
  process.exit(1);
}

// Next's standalone output intentionally omits these assets so they can be
// deployed separately. Copy them for local `npm start` and Playwright runs.
await mkdir(path.join(standaloneDir, "public"), { recursive: true });
await cp(path.join(projectDir, "public"), path.join(standaloneDir, "public"), {
  recursive: true,
  force: true,
});
await mkdir(path.join(standaloneDir, ".next", "static"), { recursive: true });
await cp(path.join(buildDir, "static"), path.join(standaloneDir, ".next", "static"), {
  recursive: true,
  force: true,
});

const server = spawn(process.execPath, [serverPath], {
  cwd: standaloneDir,
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: process.env.BIND_HOST ?? "0.0.0.0",
    PORT: process.env.PORT ?? process.env.E2E_PORT ?? "3000",
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.kill(signal));
}

server.on("error", (error) => {
  console.error("Could not start the standalone Next.js server:", error);
  process.exitCode = 1;
});
server.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
