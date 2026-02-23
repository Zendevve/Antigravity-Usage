import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ConnectionResult {
  port: number;
  token?: string;
}

export async function detectConnection(context: vscode.ExtensionContext): Promise<ConnectionResult | null> {
  // Step 1: Env
  if (process.env.ANTIGRAVITY_PORT) {
    return {
      port: parseInt(process.env.ANTIGRAVITY_PORT, 10),
      token: process.env.ANTIGRAVITY_TOKEN,
    };
  }

  // Step 2: Process check
  try {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'tasklist' : 'ps aux | grep antigravity';
    const output = cp.execSync(cmd, { encoding: 'utf8' });
    if (!output.toLowerCase().includes('antigravity')) {
      // no process found, but we'll keep trying
    }
  } catch {
    // ignore process check errors
  }

  // Step 3: Config file
  try {
    const configPath = path.join(os.homedir(), '.antigravity', 'config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.port) {
        return { port: data.port, token: data.token };
      }
    }
  } catch {
    // ignore
  }

  // Step 4: Known ports probe (13337, 13338, 13339)
  const ports = [13337, 13338, 13339];
  for (const p of ports) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`http://localhost:${p}/health`, { signal: controller.signal as RequestInit['signal'] });
      clearTimeout(id);
      if (res.ok) return { port: p };
    } catch {
      // ignore
    }
  }

  // Step 5: User Prompt
  const userInput = await vscode.window.showInputBox({
    prompt: 'Could not auto-detect Antigravity. Enter port:',
    placeHolder: '13337',
  });

  if (userInput) {
    const pt = parseInt(userInput, 10);
    if (!isNaN(pt)) return { port: pt };
  }

  return null;
}
