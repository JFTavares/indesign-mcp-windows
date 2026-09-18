import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runFile = promisify(execFile);
const runner = fileURLToPath(new URL('../scripts/invoke-indesign.ps1', import.meta.url));
export const jsxString = value => JSON.stringify(String(value)).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// eval preserves the completion value of if/else and try/catch, unlike assigning
// to a guessed last line. The source is a quoted string, never shell code.
export function wrapScript(source, resultPath) {
  return `(function () {
    var output, status = "OK\\n";
    var oldInteraction = app.scriptPreferences.userInteractionLevel;
    try {
      app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
      output = eval(${jsxString(source)});
      if (typeof output === "undefined") output = "(no return value)";
    } catch (e) {
      status = "ERROR\\n";
      output = e.message + " (line " + (e.line || "unknown") + ")";
    } finally {
      app.scriptPreferences.userInteractionLevel = oldInteraction;
    }
    var file = new File(${jsxString(resultPath.replace(/\\/g, '/'))});
    file.encoding = "UTF-8";
    if (!file.open("w")) throw new Error("Cannot write bridge result: " + file.error);
    file.write(status + String(output));
    file.close();
  }());`;
}

export class WindowsBridge {
  constructor({ run = runFile, platform = process.platform, timeout = Number(process.env.INDESIGN_TIMEOUT_MS || 60000), progId = process.env.INDESIGN_PROGID || 'InDesign.Application' } = {}) {
    if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 1800000) throw new Error('INDESIGN_TIMEOUT_MS must be between 1000 and 1800000');
    this.run = run;
    this.platform = platform;
    this.timeout = timeout;
    this.progId = progId;
    this.queue = Promise.resolve();
    this.uncertain = false;
  }

  execute(source) {
    const request = this.queue.then(() => this.executeOne(source));
    this.queue = request.catch(() => {});
    return request;
  }

  async executeOne(source) {
    if (this.platform !== 'win32') throw new Error('This bridge requires Windows and desktop Adobe InDesign.');
    if (this.uncertain) throw new Error('Previous operation timed out. Check InDesign and restart the MCP server before continuing.');
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'indesign-mcp-'));
    const scriptPath = path.join(directory, 'script.jsx');
    const resultPath = path.join(directory, 'result.txt');
    let timedOut = false;
    try {
      await fs.writeFile(scriptPath, wrapScript(source, resultPath), 'utf8');
      const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      await this.run(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', runner, '-ScriptPath', scriptPath, '-ProgId', this.progId], {
        windowsHide: true, timeout: this.timeout, maxBuffer: 1024 * 1024, encoding: 'utf8'
      });
      const result = (await fs.readFile(resultPath, 'utf8')).replace(/^\uFEFF/, '');
      const header = /^(OK|ERROR)\r?\n/.exec(result);
      if (!header) throw new Error('Invalid response from InDesign.');
      if (header[1] === 'ERROR') throw new Error(result.slice(header[0].length));
      return result.slice(header[0].length);
    } catch (error) {
      if (error.killed || error.code === 'ETIMEDOUT') {
        timedOut = true;
        this.uncertain = true;
        throw new Error(`InDesign timed out after ${this.timeout} ms. It may still be executing; check it before restarting the MCP server. Temporary files retained: ${directory}`);
      }
      throw new Error(`InDesign Windows bridge: ${(error.stderr || error.message).trim()}`);
    } finally {
      // A COM timeout cannot cancel the operation inside InDesign.
      if (!timedOut) await fs.rm(directory, { recursive: true, force: true });
    }
  }
}
