import { spawnSync } from "node:child_process";

const serviceName = (process.env.SERVICE ?? process.env.RAILWAY_SERVICE_NAME ?? "").trim();

const packageByService = {
  api: "@project-overload/api",
  web: "@project-overload/web",
  worker: "@project-overload/worker",
};

const targetPackage = packageByService[serviceName];

if (!targetPackage) {
  const known = Object.keys(packageByService).join(", ");
  console.error(
    `Unsupported or missing SERVICE/RAILWAY_SERVICE_NAME: "${serviceName}". Expected one of: ${known}.`,
  );
  process.exit(1);
}

const result = spawnSync("pnpm", ["--filter", targetPackage, "start"], {
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
