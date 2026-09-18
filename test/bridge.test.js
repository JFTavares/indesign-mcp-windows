import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WindowsBridge, wrapScript } from '../lib/windows-bridge.js';

test('captures branch completion and preserves Unicode and escaped strings', () => {
  let written;
  const app = { scriptPreferences: { userInteractionLevel: 7 } };
  function File() {
    this.open = () => true;
    this.write = value => { written = value; };
    this.close = () => {};
  }
  const context = { app, File, UserInteractionLevels: { NEVER_INTERACT: 0 } };
  const value = 'ação \\"';
  vm.runInNewContext(wrapScript(`if (true) { ${JSON.stringify(value)}; } else { "no"; }`, 'C:\\Usuário\\out.txt'), context);
  assert.equal(written, 'OK\nação \\"');
  assert.equal(app.scriptPreferences.userInteractionLevel, 7);
  vm.runInNewContext(wrapScript('throw new Error("falha");', 'C:/out.txt'), context);
  assert.match(written, /^ERROR\nfalha/);
  assert.equal(app.scriptPreferences.userInteractionLevel, 7);
});

test('serializes COM calls, uses argument arrays and cleans unique directories', async () => {
  const directories = [];
  let active = 0;
  const bridge = new WindowsBridge({ platform: 'win32', run: async (command, args, options) => {
    assert.equal(++active, 1);
    assert.equal(options.windowsHide, true);
    assert.equal(options.shell, undefined);
    assert.ok(args.includes('-STA'));
    const scriptPath = args[args.indexOf('-ScriptPath') + 1];
    const directory = path.dirname(scriptPath);
    directories.push(directory);
    assert.match(await fs.readFile(scriptPath, 'utf8'), /eval\(/);
    await fs.writeFile(path.join(directory, 'result.txt'), '\uFEFFOK\r\nolá');
    active--;
  } });
  assert.deepEqual(await Promise.all([bridge.execute('1;'), bridge.execute('2;')]), ['olá', 'olá']);
  assert.notEqual(directories[0], directories[1]);
  for (const directory of directories) await assert.rejects(fs.access(directory));
});

test('timeout prevents automatic replay or further execution', async () => {
  let directory;
  const bridge = new WindowsBridge({ platform: 'win32', run: async (_command, args) => {
    directory = path.dirname(args[args.indexOf('-ScriptPath') + 1]);
    throw Object.assign(new Error('timeout'), { killed: true });
  } });
  await assert.rejects(bridge.execute('1;'), /may still be executing/);
  await assert.rejects(bridge.execute('2;'), /restart/);
  await fs.rm(directory, { recursive: true, force: true });
});
