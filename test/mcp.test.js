import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { InDesignMCPServer } from '../index.js';

test('MCP initialization, 51 tools, schema validation and destructive guard', async () => {
  let calls = 0;
  const server = new InDesignMCPServer({ bridge: { execute: async script => { new vm.Script(script); calls++; return 'OK'; } } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0' });
  await server.server.connect(a);
  await client.connect(b);
  try {
    assert.equal((await client.listTools()).tools.length, 51);
    await assert.rejects(client.callTool({ name: 'create_text_frame', arguments: {} }), /content/);
    assert.equal((await client.callTool({ name: 'close_document', arguments: {} })).isError, true);
    assert.equal(calls, 0);
    assert.equal((await client.callTool({ name: 'create_document', arguments: {} })).isError, false);
    assert.equal((await client.callTool({ name: 'create_text_frame', arguments: { content: 'ação "oi" C:\\teste\nsegunda linha' } })).isError, false);
    assert.equal(calls, 2);
  } finally { await client.close(); await server.server.close(); }
});

test('stdio server handshake and listing do not require InDesign', async () => {
  const client = new Client({ name: 'stdio-test', version: '1.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: ['index.js'], stderr: 'pipe' });
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 51);
  } finally { await client.close(); }
});

test('all 51 handlers generate syntactically valid JavaScript', async () => {
  const server = new InDesignMCPServer({ bridge: { execute: async script => { new vm.Script(script); return 'OK'; } } });
  server.allowedDirectories = [process.cwd()];
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'catalog-test', version: '1.0' });
  const previous = process.env.INDESIGN_ALLOW_ARBITRARY_CODE;
  process.env.INDESIGN_ALLOW_ARBITRARY_CODE = '1';
  await server.server.connect(a);
  await client.connect(b);
  try {
    for (const tool of server.tools) {
      const args = { confirmDestructive: true };
      for (const key of tool.inputSchema.required || []) {
        const property = tool.inputSchema.properties[key];
        args[key] = property.enum?.[0] ?? (property.type === 'number' ? 3 : property.type === 'array' ? (key === 'data' ? [['a', 'b']] : [0, 0, 0, 100]) : 'Teste');
        if (/Path$|Folder$/.test(key)) args[key] = path.resolve('artifacts', 'test.indd');
      }
      if (tool.name === 'execute_indesign_code') args.code = '"OK";';
      const result = await client.callTool({ name: tool.name, arguments: args });
      assert.equal(result.isError, false, tool.name + ': ' + JSON.stringify(result.content));
    }
  } finally {
    if (previous === undefined) delete process.env.INDESIGN_ALLOW_ARBITRARY_CODE;
    else process.env.INDESIGN_ALLOW_ARBITRARY_CODE = previous;
    await client.close(); await server.server.close();
  }
});
