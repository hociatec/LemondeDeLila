const fs = require('fs');
const path = require('path');

const distPath = path.resolve(process.cwd(), 'dist');

function sleepMs(ms) {
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, Math.max(0, ms | 0));
}

function safeRmSync(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function listLockedDists(rootDir) {
  try {
    return fs
      .readdirSync(rootDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('dist.locked-'))
      .map((d) => path.join(rootDir, d.name));
  } catch {
    return [];
  }
}

function cleanupOldLockedDists(rootDir, maxKeep = 3) {
  const locked = listLockedDists(rootDir);
  if (locked.length <= maxKeep) return;

  const sorted = locked
    .map((p) => {
      try {
        return { p, mtimeMs: fs.statSync(p).mtimeMs };
      } catch {
        return { p, mtimeMs: 0 };
      }
    })
    .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0))
    .map((x) => x.p);

  const toDelete = sorted.slice(maxKeep);
  for (const p of toDelete) {
    try {
      safeRmSync(p);
    } catch {
      // Best-effort cleanup: ignore (still locked / permissions / etc.)
    }
  }
}

if (!fs.existsSync(distPath)) {
  return;
}

try {
  // Attempt a few retries: Windows can transiently keep file handles.
  const rootDir = path.dirname(distPath);
  cleanupOldLockedDists(rootDir, 3);

  let removed = false;
  const delays = [0, 80, 200, 500, 1000];
  for (const delay of delays) {
    if (delay) sleepMs(delay);
    try {
      safeRmSync(distPath);
      removed = true;
      break;
    } catch (err) {
      // Only retry on common Windows lock errors.
      const code = err && err.code;
      if (!['EACCES', 'EPERM', 'EBUSY'].includes(code)) {
        throw err;
      }
    }
  }

  if (removed) {
    return;
  }

  // Still locked: fall back to renaming, but prevent unbounded accumulation.
  const fallbackPath = `${distPath}.locked-${Date.now()}-${Math.floor(
    Math.random() * 1000,
  )}`;

  fs.renameSync(distPath, fallbackPath);
  console.warn(
    `[prepare-dist] Could not remove ${distPath} (locked). Renamed to ${fallbackPath} so the build can continue.`,
  );
  console.warn(
    `[prepare-dist] Tip: stop the running backend (node on dist/main) and delete dist.locked-* folders to free disk space.`,
  );

  cleanupOldLockedDists(path.dirname(distPath), 3);
} catch (error) {
  throw error;
}
