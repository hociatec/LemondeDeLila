const fs = require('fs');
const path = require('path');

const distPath = path.resolve(process.cwd(), 'dist');

if (!fs.existsSync(distPath)) {
  // Nothing to clean yet.
  return;
}

try {
  fs.rmSync(distPath, { recursive: true, force: true });
} catch (error) {
  if (error && ['EACCES', 'EPERM'].includes(error.code) && fs.existsSync(distPath)) {
    const fallbackPath = `${distPath}.locked-${Date.now()}-${Math.floor(
      Math.random() * 1000,
    )}`;

    // Keep the old dist out of the way instead of failing the build.
    fs.renameSync(distPath, fallbackPath);
    console.warn(
      `[prepare-dist] Could not remove ${distPath} (${error.code}). Renamed to ${fallbackPath} so the build can continue.`,
    );
  } else {
    throw error;
  }
}
