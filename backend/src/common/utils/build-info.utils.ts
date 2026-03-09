import * as fs from 'fs';
import * as path from 'path';

export type BuildInfo = {
  sha: string | null;
  ref: string | null;
  source: 'env' | 'git' | 'unknown';
  node: string;
  startedAt: string;
};

const STARTED_AT = new Date().toISOString();
let cached: BuildInfo | null = null;

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function findGitDir(startDir: string, maxUp = 6): string | null {
  let current = startDir;
  for (let i = 0; i <= maxUp; i += 1) {
    const candidate = path.join(current, '.git');
    const head = path.join(candidate, 'HEAD');
    if (fileExists(head)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (!parent || parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

function resolvePackedRef(gitDir: string, ref: string): string | null {
  const packed = readText(path.join(gitDir, 'packed-refs'));
  if (!packed) return null;
  const lines = packed.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('^')) {
      continue;
    }
    const [sha, name] = trimmed.split(' ');
    if (!sha || !name) continue;
    if (name === ref) return sha;
  }
  return null;
}

function tryResolveGitHeadSha(): { sha: string | null; ref: string | null } {
  const gitDir = findGitDir(process.cwd());
  if (!gitDir) {
    return { sha: null, ref: null };
  }

  const headText = (readText(path.join(gitDir, 'HEAD')) ?? '').trim();
  if (!headText) {
    return { sha: null, ref: null };
  }

  const refPrefix = 'ref:';
  if (headText.toLowerCase().startsWith(refPrefix)) {
    const ref = headText.substring(refPrefix.length).trim();
    if (!ref) return { sha: null, ref: null };

    const refPath = path.join(gitDir, ref);
    const sha =
      (readText(refPath) ?? '').trim() ||
      resolvePackedRef(gitDir, ref);
    return {
      sha: sha && sha.length >= 7 ? sha : null,
      ref,
    };
  }

  return {
    sha: headText.length >= 7 ? headText : null,
    ref: null,
  };
}

export function getBuildInfo(): BuildInfo {
  if (cached) {
    return cached;
  }

  const envSha =
    (process.env.LEMONDEDELILA_GIT_SHA ?? '').trim() ||
    (process.env.GITHUB_SHA ?? '').trim() ||
    (process.env.COMMIT_SHA ?? '').trim() ||
    (process.env.SOURCE_VERSION ?? '').trim();

  if (envSha) {
    cached = {
      sha: envSha,
      ref: null,
      source: 'env',
      node: process.version,
      startedAt: STARTED_AT,
    };
    return cached;
  }

  const resolved = tryResolveGitHeadSha();
  cached = {
    sha: resolved.sha,
    ref: resolved.ref,
    source: resolved.sha ? 'git' : 'unknown',
    node: process.version,
    startedAt: STARTED_AT,
  };
  return cached;
}

