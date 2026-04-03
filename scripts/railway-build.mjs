import { spawnSync } from "node:child_process";

const serviceName = (process.env.SERVICE ?? process.env.RAILWAY_SERVICE_NAME ?? "").trim();

const packageByService = {
  api: "@project-overload/api...",
  web: "@project-overload/web...",
  worker: "@project-overload/worker...",
};

const args = serviceName && packageByService[serviceName]
  ? ["--filter", packageByService[serviceName], "build"]
  : ["-r", "--if-present", "build"];

const result = spawnSync("pnpm", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error);
}

process.exit(1);
