import { defineConfig } from "@trigger.dev/sdk";

// Trigger CLI evaluates this config before applying its --env-file option.
// Load the app's local config first so the project ref is available at setup time.
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI and deployed environments provide these variables directly.
}

const project = process.env.TRIGGER_PROJECT_REF;

if (!project) throw new Error("Set TRIGGER_PROJECT_REF to your Trigger.dev project reference.");

export default defineConfig({
  project,
  dirs: ["./trigger"],
  maxDuration: 900,
  retries: { enabledInDev: false, default: { maxAttempts: 2, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 10000, randomize: true } },
  build: { external: ["sharp"] },
});
