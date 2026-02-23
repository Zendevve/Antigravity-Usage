import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ConnectionResult {
  port: number;
  token?: string;
  source?: string;
}

export function checkEnvVariables(): ConnectionResult | null {
  const env = process.env as Record<string, string | undefined>;
  const portStr = env['ANTIGRAVITY_PORT'];
  const token = env['ANTIGRAVITY_TOKEN'];

  if (portStr) {
    const port = parseInt(portStr, 10);
    if (!isNaN(port)) {
      return { port, token, source: 'env' };
    }
  }
  return null;
}

export async function detectConnection(): Promise<ConnectionResult | null> {
  // Step 1: Env
  const envConnection = checkEnvVariables();
  if (envConnection) {
    return envConnection;
  }

  // Step 2: Process check
  try {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'tasklist' : 'ps aux | grep antigravity';
    const output = cp.execSync(cmd, { encoding: 'utf8' });
    if (output.toLowerCase().includes('antigravity')) {
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('antigravity') && line.includes('--port')) {
          const match = line.match(/--port\s+(\d+)/);
          const tokenMatch = line.match(/--token\s+([a-zA-Z0-9_-]+)/);
          if (match) {
            return {
              port: parseInt(match[1], 10),
              token: tokenMatch ? tokenMatch[1] : undefined,
              source: 'process'
            };
          }
        }
      }
    }
  } catch {
    // ignore process check errors
  }

  // Step 3: Config file
  try {
    const configPath = path.join(os.homedir(), '.antigravity', 'config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { port?: number, token?: string };
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
