import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WindowsBridge } from '../lib/windows-bridge.js';

const directory = path.resolve('artifacts', `smoke-${Date.now()}`, 'ação com espaços');
await fs.mkdir(directory, { recursive: true });
const bridge = new WindowsBridge();
// Avoid changing a user's active document. This test is intended for an empty session.
assert.equal(await bridge.execute('String(app.documents.length);'), '0', 'Close documents before running the integration test.');
const client = new Client({ name: 'windows-integration-test', version: '1.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve('index.js')], stderr: 'pipe' });
let ownedId;
const results = [];
async function call(name, args = {}) {
  if (ownedId !== undefined) assert.equal(await bridge.execute('String(app.activeDocument.id);'), ownedId, 'Active document changed; stopping test.');
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 90000 });
  const text = result.content.map(item => item.text || '').join('\n');
  results.push({ tool: name, isError: !!result.isError, text });
  console.log(`${name}: ${text}`);
  assert.equal(result.isError, false, text);
  return text;
}
try {
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 51);
  await call('create_document', { preset: 'A4', pages: 2 });
  ownedId = await bridge.execute('String(app.activeDocument.id);');
  await call('create_layer', { name: 'Conteúdo' });
  await call('create_color_swatch', { name: 'Azul teste', colorModel: 'RGB', colorValues: [20, 70, 160] });
  await call('create_paragraph_style', { name: 'Título teste', fontSize: 20 });
  await call('create_text_frame', { content: 'Automação InDesign no Windows\nPortuguês: ação, coração, "aspas" e C:\\teste', x: 20, y: 20, width: 170, height: 45, fontFamily: 'Arial', fontSize: 16 });
  const contents = await bridge.execute('app.activeDocument.pages[0].textFrames[0].contents;');
  assert.ok(contents.includes('ação') && contents.includes('C:\\teste') && /["“]aspas["”]/.test(contents), contents);
  await call('create_rectangle', { x: 20, y: 80, width: 60, height: 20 });
  await call('create_table', { x: 20, y: 115, width: 150, height: 50, rows: 3, columns: 2 });
  await call('populate_table', { tableIndex: 0, data: [['Item', 'Valor'], ['Teste A', '10'], ['Teste B', '20']] });
  assert.equal(await bridge.execute('String(app.activeDocument.stories.everyItem().tables.everyItem().getElements()[0].rows.length);'), '3');
  await call('get_document_info');
  const indd = path.join(directory, 'validação.indd');
  const pdf = path.join(directory, 'validação.pdf');
  await call('save_document', { filePath: indd, confirmDestructive: true });
  await call('export_pdf', { filePath: pdf, confirmDestructive: true });
  assert.ok((await fs.stat(indd)).size > 0);
  assert.equal((await fs.readFile(pdf)).subarray(0, 5).toString(), '%PDF-');
  await call('close_document', { confirmDestructive: true });
  ownedId = undefined;
  await call('open_document', { filePath: indd });
  ownedId = await bridge.execute('String(app.activeDocument.id);');
  assert.equal(await bridge.execute('String(app.activeDocument.pages.length);'), '2');
  await call('close_document', { confirmDestructive: true });
  ownedId = undefined;
  console.log(`PASS: real MCP/COM integration. Artifacts: ${directory}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (ownedId !== undefined) {
    // Close only the document created by this test, even if the active document changed.
    await bridge.execute(`var d = app.documents.itemByID(${Number(ownedId)}); if (d.isValid) d.close(SaveOptions.NO);`).catch(error => console.error(error.message));
  }
  await client.close();
  await fs.writeFile(path.join(directory, 'results.json'), JSON.stringify(results, null, 2));
}
