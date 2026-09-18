import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateFilePath } from '../lib/paths.js';

test('accepts accented paths and rejects sibling prefixes, traversal and relative paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'indesign-path-test-'));
  try {
    assert.equal(validateFilePath(path.join(root, 'ação', 'arquivo.indd'), [root]), path.join(fs.realpathSync.native(root), 'ação', 'arquivo.indd').replace(/\\/g, '/'));
    assert.throws(() => validateFilePath(root + '-other/file.indd', [root]), /Access denied/);
    assert.throws(() => validateFilePath(path.join(root, '..', 'outside.indd'), [root]), /Access denied/);
    assert.throws(() => validateFilePath('relative.indd', [root]), /absolute/);
    if (process.platform === 'win32') {
      assert.throws(() => validateFilePath(root + '\\file:stream', [root]), /streams/);
      assert.throws(() => validateFilePath('\\\\server\\share\\file', [root]), /UNC/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
