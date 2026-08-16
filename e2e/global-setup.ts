import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request, type FullConfig } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = path.resolve(HERE);
const REPO_ROOT = path.resolve(E2E_ROOT, '..');
const ENV_FILE = path.join(REPO_ROOT, 'infra', '.env');
const ENV_EXAMPLE = path.join(REPO_ROOT, 'infra', '.env.example');
const AUTH_STATE_DIR = path.join(E2E_ROOT, '.auth');

const CLOUDINARY_KEYS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

/** Values that mean "nobody filled this in" — see infra/.env.example. */
const PLACEHOLDERS = new Set([
  '',
  'placeholder',
  'your_cloud_name',
  'your_api_key',
  'your_api_secret',
  'change_me_in_production',
]);

function banner(lines: string[]): string {
  const width = Math.max(...lines.map((l) => l.length)) + 4;
  const rule = '='.repeat(width);
  return ['', rule, ...lines.map((l) => `  ${l}`), rule, ''].join('\n');
}

/** Minimal dotenv reader — infra/.env is a plain KEY=VALUE file. */
function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Cloudinary is REQUIRED, not optional: return creation (service-rep photos +
 * drawn signature), pickup confirmation and warehouse receiving all upload
 * through it. With placeholder creds those flows fail at runtime and half the
 * suite would fail for the wrong reason — so fail fast and loud instead.
 */
function preflightCloudinary(): void {
  const fileEnv = readEnvFile(ENV_FILE);
  const missing: string[] = [];

  for (const key of CLOUDINARY_KEYS) {
    const value = (process.env[key] ?? fileEnv[key] ?? '').trim();
    if (PLACEHOLDERS.has(value) || PLACEHOLDERS.has(value.toLowerCase())) {
      missing.push(key);
    }
  }

  if (missing.length === 0) return;

  const hasEnvFile = fs.existsSync(ENV_FILE);
  throw new Error(
    banner([
      'E2E PREFLIGHT FAILED — Cloudinary credentials are missing or still placeholders.',
      '',
      `Unusable: ${missing.join(', ')}`,
      `Env file: ${ENV_FILE}${hasEnvFile ? '' : '  (DOES NOT EXIST)'}`,
      '',
      'The suite always exercises the upload + signature paths, so real creds are',
      'mandatory. Fix it with:',
      '',
      `  cp ${path.relative(REPO_ROOT, ENV_EXAMPLE)} ${path.relative(REPO_ROOT, ENV_FILE)}`,
      '  # then set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET',
      '  # from https://cloudinary.com/console',
      '',
      'Nothing was started; no containers were touched.',
    ]),
  );
}

function runDevScript(task: 'nuke' | 'up' | 'docker:rebuild'): void {
  // eslint-disable-next-line no-console
  console.log(`[e2e] ./dev.sh ${task}`);
  const result = spawnSync('./dev.sh', [task], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    throw new Error(`[e2e] failed to execute ./dev.sh ${task}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`[e2e] ./dev.sh ${task} exited with code ${result.status}`);
  }
}

/**
 * Two things go stale between runs, and only one of them is obvious:
 *
 * 1. The DATA. database/seed.sql only runs on a FRESH postgres volume (it is
 *    mounted into docker-entrypoint-initdb.d), so a plain restart keeps whatever
 *    junk a previous run left behind. `nuke` drops the volumes; bringing the
 *    stack back up recreates them and re-runs 01_schema.sql + 02_seed.sql.
 * 2. The WAR. `./dev.sh up` is a bare `docker compose up -d` — it compiles
 *    NOTHING, so the container re-deploys whatever server image happens to be
 *    cached locally. That is how a whole suite ends up asserting on selectors
 *    that exist in xhtml source but were never deployed. `./dev.sh
 *    docker:rebuild` runs `compose build server` first, so the WAR matches HEAD.
 *
 * E2E_SKIP_BUILD=1 downgrades step 2 back to `up` for fast test-only iteration —
 * you are then on the hook for the deployed WAR already being current (the
 * freshness check in waitForApp() still guards the obvious case).
 */
function resetStack(): void {
  if (process.env.E2E_SKIP_STACK === '1') {
    // eslint-disable-next-line no-console
    console.log('[e2e] E2E_SKIP_STACK=1 — reusing the running stack (DB is NOT reset).');
    return;
  }
  const skipBuild = process.env.E2E_SKIP_BUILD === '1';
  if (skipBuild) {
    // eslint-disable-next-line no-console
    console.log('[e2e] E2E_SKIP_BUILD=1 — starting the stack WITHOUT recompiling the WAR.');
  }
  runDevScript('nuke');
  runDevScript(skipBuild ? 'up' : 'docker:rebuild');
}

/**
 * Markers that prove the deployed WAR was built from current source.
 *
 * RoleAuthFilter lets exactly one page through unauthenticated — /login.xhtml —
 * so that is the only sentinel global-setup can fetch. It carries no data-testid
 * of its own (it does not use WEB-INF/templates/layout.xhtml, which is where the
 * pt:data-testid nav links live), but it does carry
 * `<p:message id="phoneMsg" for="phone"/>`, which renders as id="loginForm:phoneMsg".
 * A WAR built before that id was added renders the auto-generated
 * id="loginForm:j_idt9" instead — that is the tell.
 *
 * EITHER marker passes, so adding a data-testid to the login page later cannot
 * turn this into a false alarm.
 */
const FRESH_BUILD_MARKERS = ['loginForm:phoneMsg', 'data-testid'] as const;

/**
 * A stale deploy is silent: every page still answers 200, tests just cannot find
 * selectors that only ever existed in source. That failure mode once cost ~120
 * specs and a full 25-minute run, so abort global-setup loudly instead.
 */
function assertFreshDeploy(url: string, html: string): void {
  if (FRESH_BUILD_MARKERS.some((marker) => html.includes(marker))) return;

  throw new Error(
    banner([
      'E2E PREFLIGHT FAILED — the deployed WAR is STALE.',
      '',
      `${url} answered 200, but its HTML carries none of the markers this`,
      `source tree renders: ${FRESH_BUILD_MARKERS.join(', ')}.`,
      '',
      'The container is running an image built from older sources, so the suite',
      'would fail en masse on selectors that were never deployed. Rebuild with:',
      '',
      '  ./dev.sh docker:rebuild',
      '',
      '(If you set E2E_SKIP_STACK=1 or E2E_SKIP_BUILD=1, that is why nothing was built.)',
    ]),
  );
}

async function waitForApp(baseURL: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `${baseURL.replace(/\/$/, '')}/login.xhtml`;
  const ctx = await request.newContext({ ignoreHTTPSErrors: true });
  let lastProblem = 'no response yet';
  let attempt = 0;
  // Held until the request context is disposed — the freshness check must NOT
  // run inside the retry loop, where the catch below would swallow its throw
  // and quietly keep polling a stale-but-healthy app until the deadline.
  let servedHtml: string | null = null;

  try {
    while (Date.now() < deadline) {
      attempt += 1;
      try {
        const res = await ctx.get(url, { timeout: 10_000, failOnStatusCode: false });
        if (res.status() === 200) {
          // eslint-disable-next-line no-console
          console.log(`[e2e] ${url} answered 200 after ${attempt} attempt(s).`);
          servedHtml = await res.text();
          break;
        }
        lastProblem = `HTTP ${res.status()}`;
      } catch (err) {
        lastProblem = err instanceof Error ? err.message : String(err);
      }
      if (attempt % 10 === 0) {
        // eslint-disable-next-line no-console
        console.log(`[e2e] still waiting for ${url} (${lastProblem})`);
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }
  } finally {
    await ctx.dispose();
  }

  if (servedHtml !== null) {
    // Answering 200 is not the same as being current — see assertFreshDeploy.
    assertFreshDeploy(url, servedHtml);
    return;
  }

  throw new Error(
    banner([
      `E2E PREFLIGHT FAILED — ${url} never returned 200 within ${Math.round(timeoutMs / 1000)}s.`,
      `Last problem: ${lastProblem}`,
      '',
      'Check the stack with:  docker compose -f infra/docker-compose.yml logs -f server',
    ]),
  );
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ??
    process.env.E2E_BASE_URL ??
    'http://localhost:8080';

  // 1. Fail fast, before anything is torn down.
  preflightCloudinary();

  // 2. Fresh DB + fresh app.
  resetStack();

  // 3. Stale storageState from a previous run points at dead JSESSIONIDs.
  fs.rmSync(AUTH_STATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });

  // 4. WildFly deploys the WAR well after the container reports "up".
  const bootTimeout = Number(process.env.E2E_BOOT_TIMEOUT_MS ?? 300_000);
  await waitForApp(baseURL, bootTimeout);
}
