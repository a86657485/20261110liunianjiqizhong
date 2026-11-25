'use strict';
/**
 * 控制探秘营 · 服务守护进程
 * 由 Windows 计划任务在开机/登录时拉起（S4U，无窗口）。
 * 职责：启动 server/index.cjs；异常退出后自动重启；收到停止标记后整体退出。
 */
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

const APP_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(APP_DIR, 'data');
const LOG_FILE = path.join(DATA_DIR, 'service.log');
const PID_FILE = path.join(DATA_DIR, 'service.pid');
const STOP_FLAG = path.join(__dirname, 'STOP.flag');
const PORT = Number(process.env.PORT) || 8830;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (fs.existsSync(STOP_FLAG)) fs.rmSync(STOP_FLAG, { force: true });

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '\uFEFF', 'utf8');
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch { /* ignore */ }
};

function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    const done = (v) => { try { s.destroy(); } catch { /* ignore */ } resolve(v); };
    s.setTimeout(900);
    s.once('connect', () => done(true));
    s.once('timeout', () => done(false));
    s.once('error', () => done(false));
  });
}

let child = null;
let stopping = false;
let fastFails = 0;

function startChild() {
  if (stopping) return;
  if (fs.existsSync(STOP_FLAG)) {
    log('检测到停止标记，守护进程退出');
    process.exit(0);
  }
  const startedAt = Date.now();
  log(`拉起服务：node --no-warnings server/index.cjs（端口 ${PORT}）`);
  child = spawn(process.execPath, ['--no-warnings', 'server/index.cjs'], {
    cwd: APP_DIR,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(PORT), DATA_DIR },
  });

  child.on('exit', (code, signal) => {
    const lived = Date.now() - startedAt;
    child = null;
    log(`服务退出 code=${code} signal=${signal || '-'} 运行 ${Math.round(lived / 1000)} 秒`);
    if (stopping) return;
    if (fs.existsSync(STOP_FLAG)) {
      log('检测到停止标记，守护进程退出');
      process.exit(0);
    }
    fastFails = lived < 10000 ? fastFails + 1 : 0;
    const wait = fastFails >= 5 ? 60000 : fastFails > 0 ? 10000 : 3000;
    log(`${Math.round(wait / 1000)} 秒后重启（连续快速失败 ${fastFails} 次）`);
    setTimeout(startChild, wait);
  });

  child.on('error', (err) => log('子进程启动失败：' + err.message));
}

function shutdown(reason) {
  if (stopping) return;
  stopping = true;
  log(`收到停止信号（${reason}），正在结束服务`);
  if (child) {
    try { child.kill(); } catch { /* ignore */ }
  }
  setTimeout(() => process.exit(0), 1500);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

(async () => {
  if (await portInUse(PORT)) {
    log(`端口 ${PORT} 已在监听，守护进程退出（避免重复实例）`);
    process.exit(0);
  }
  try { fs.writeFileSync(PID_FILE, String(process.pid)); } catch { /* ignore */ }
  log(`守护进程启动 pid=${process.pid}，目录 ${APP_DIR}`);
  startChild();
})();
