import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function allowedDirectories() {
  return process.env.INDESIGN_ALLOWED_DIRS
    ? process.env.INDESIGN_ALLOWED_DIRS.split(path.delimiter).filter(Boolean)
    : [os.homedir()];
}

function canonical(filePath) {
  let existing = path.resolve(filePath);
  const suffix = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error('Path has no accessible parent');
    suffix.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(fs.realpathSync.native(existing), ...suffix);
}

export function validateFilePath(filePath, roots = allowedDirectories()) {
  if (typeof filePath !== 'string' || !filePath || /[\x00-\x1f"]/.test(filePath)) throw new Error('Invalid file path');
  if (!path.isAbsolute(filePath)) throw new Error('Use an absolute file path');
  if (process.platform === 'win32' && (filePath.startsWith('\\\\') || filePath.slice(2).includes(':'))) throw new Error('UNC, device paths and alternate data streams are not supported');
  const resolved = canonical(filePath);
  const allowed = roots.some(root => {
    const relative = path.relative(canonical(root), resolved);
    return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
  });
  if (!allowed) throw new Error(`Access denied: path is outside INDESIGN_ALLOWED_DIRS: ${filePath}`);
  // ExtendScript accepts forward slashes on Windows, including accented paths.
  return resolved.replace(/\\/g, '/');
}
