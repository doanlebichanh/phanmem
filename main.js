const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let server;
let autoBackupTimer;
let backupConfigPath;

const RETAIN_LATEST_COUNT = 5;
const RETAIN_MONTHLY_COUNT = 12;

function safeMkdirp(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  safeMkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function defaultBackupDir() {
  // Default to Documents\FreightManager Backups
  return path.join(app.getPath('documents'), 'FreightManager Backups');
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function buildDbFingerprint(dbPath) {
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  const dbStat = safeStat(dbPath);
  const walStat = safeStat(walPath);
  const shmStat = safeStat(shmPath);

  // Fingerprint is intentionally simple and robust across restarts.
  return JSON.stringify({
    db: dbStat ? { mtimeMs: dbStat.mtimeMs, size: dbStat.size } : null,
    wal: walStat ? { mtimeMs: walStat.mtimeMs, size: walStat.size } : null,
    shm: shmStat ? { mtimeMs: shmStat.mtimeMs, size: shmStat.size } : null
  });
}

function parseBackupTimestampFromDirName(dirName) {
  // Expected: FreightManager_Backup_2026-01-08T12-34-56-789Z
  const prefix = 'FreightManager_Backup_';
  if (!dirName.startsWith(prefix)) return null;
  const raw = dirName.slice(prefix.length);
  // Reverse of: toISOString().replace(/[:.]/g, '-')
  // Example: 2026-01-08T12-34-56-789Z -> 2026-01-08T12:34:56.789Z
  const m = raw.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
  if (!m) return null;
  const iso = raw.replace(
    /^([0-9]{4}-[0-9]{2}-[0-9]{2}T)([0-9]{2})-([0-9]{2})-([0-9]{2})-([0-9]{3})Z$/,
    '$1$2:$3:$4.$5Z'
  );
  const dt = new Date(iso);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function listBackups(destDir) {
  try {
    if (!fs.existsSync(destDir)) return [];
    const entries = fs.readdirSync(destDir, { withFileTypes: true });
    const backups = [];
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const dt = parseBackupTimestampFromDirName(ent.name);
      if (!dt) continue;
      backups.push({
        name: ent.name,
        fullPath: path.join(destDir, ent.name),
        timestamp: dt
      });
    }
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return backups;
  } catch {
    return [];
  }
}

function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function computeMonthlyRetentionKeys(now = new Date(), months = RETAIN_MONTHLY_COUNT) {
  const keys = [];
  const d = new Date(now);
  d.setDate(1);
  for (let i = 0; i < months; i++) {
    keys.push(monthKey(d));
    d.setMonth(d.getMonth() - 1);
  }
  return new Set(keys);
}

function pruneBackups(destDir) {
  const backups = listBackups(destDir);
  if (!backups.length) return { kept: 0, removed: 0 };

  const keep = new Set();

  // 1) Always keep N most recent backups.
  for (const b of backups.slice(0, RETAIN_LATEST_COUNT)) {
    keep.add(b.fullPath);
  }

  // 2) Keep one backup per month for last 12 months (newest within the month).
  const monthlyKeys = computeMonthlyRetentionKeys(new Date(), RETAIN_MONTHLY_COUNT);
  const monthPicked = new Set();
  for (const b of backups) {
    const key = monthKey(b.timestamp);
    if (!monthlyKeys.has(key)) continue;
    if (monthPicked.has(key)) continue;
    keep.add(b.fullPath);
    monthPicked.add(key);
    if (monthPicked.size >= RETAIN_MONTHLY_COUNT) break;
  }

  let removed = 0;
  for (const b of backups) {
    if (keep.has(b.fullPath)) continue;
    try {
      fs.rmSync(b.fullPath, { recursive: true, force: true });
      removed++;
    } catch {
      // best-effort
    }
  }

  return { kept: keep.size, removed };
}

function getBackupConfig() {
  if (!backupConfigPath) {
    backupConfigPath = path.join(app.getPath('userData'), 'backup-config.json');
  }
  const cfg = readJson(backupConfigPath) || {};
  return {
    enabled: !!cfg.enabled,
    intervalHours: Number(cfg.intervalHours || 24),
    destDir: cfg.destDir || defaultBackupDir(),
    lastBackupAt: cfg.lastBackupAt || null,
    lastFingerprint: cfg.lastFingerprint || null
  };
}

function setBackupConfig(cfg) {
  const normalized = {
    enabled: !!cfg.enabled,
    intervalHours: Math.max(1, Math.min(168, Number(cfg.intervalHours || 24))),
    destDir: (cfg.destDir && String(cfg.destDir).trim()) ? String(cfg.destDir).trim() : defaultBackupDir(),
    lastBackupAt: cfg.lastBackupAt || null,
    lastFingerprint: cfg.lastFingerprint || null
  };
  if (!backupConfigPath) {
    backupConfigPath = path.join(app.getPath('userData'), 'backup-config.json');
  }
  writeJson(backupConfigPath, normalized);
  return normalized;
}

async function doBackup(destDir) {
  const { dbPath, checkpointWal } = require('./database');
  const sourceDir = path.dirname(dbPath);
  const dbName = path.basename(dbPath);

  safeMkdirp(destDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(destDir, `FreightManager_Backup_${timestamp}`);
  safeMkdirp(backupDir);

  // Best-effort checkpoint to reduce WAL inconsistency
  try { await checkpointWal('FULL'); } catch {}

  const fingerprint = buildDbFingerprint(dbPath);

  const filesToCopy = [
    path.join(sourceDir, dbName),
    path.join(sourceDir, `${dbName}-wal`),
    path.join(sourceDir, `${dbName}-shm`)
  ];

  for (const f of filesToCopy) {
    if (fs.existsSync(f)) {
      fs.copyFileSync(f, path.join(backupDir, path.basename(f)));
    }
  }

  // Best-effort retention cleanup
  const retention = pruneBackups(destDir);

  return { backupDir, dbPath, fingerprint, retention };
}

function hasDbChangedSinceLastBackup(cfg) {
  try {
    const { dbPath } = require('./database');
    const current = buildDbFingerprint(dbPath);
    if (!cfg?.lastFingerprint) return true;
    return current !== cfg.lastFingerprint;
  } catch {
    return true;
  }
}

async function stopServerAndDb() {
  try {
    if (server) {
      await new Promise(resolve => server.close(() => resolve(true)));
      server = null;
    }
  } catch {}

  try {
    const { closeDb } = require('./database');
    await closeDb();
  } catch {}
}

function startAutoBackupScheduler() {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }

  const cfg = getBackupConfig();
  if (!cfg.enabled) return;

  const intervalMs = cfg.intervalHours * 60 * 60 * 1000;
  autoBackupTimer = setInterval(async () => {
    try {
      // Only backup when DB has actually changed since last backup.
      if (!hasDbChangedSinceLastBackup(cfg)) {
        return;
      }

      const result = await doBackup(cfg.destDir);
      const updated = setBackupConfig({
        ...cfg,
        lastBackupAt: new Date().toISOString(),
        lastFingerprint: result.fingerprint,
        destDir: cfg.destDir,
        enabled: true
      });
      Object.assign(cfg, updated);
      console.log('Auto backup OK:', result.backupDir, result.retention);
    } catch (err) {
      console.error('Auto backup failed:', err);
    }
  }, intervalMs);
}

function registerIpcHandlers() {
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths?.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('db:getBackupConfig', async () => {
    return getBackupConfig();
  });

  ipcMain.handle('db:setBackupConfig', async (_evt, cfg) => {
    const updated = setBackupConfig(cfg || {});
    startAutoBackupScheduler();
    return updated;
  });

  ipcMain.handle('db:backup', async (_evt, options) => {
    const cfg = getBackupConfig();
    const destDir = options?.destDir || cfg.destDir || defaultBackupDir();
    const result = await doBackup(destDir);
    setBackupConfig({
      ...cfg,
      destDir,
      lastBackupAt: new Date().toISOString(),
      lastFingerprint: result.fingerprint
    });
    return result;
  });

  ipcMain.handle('db:restore', async (_evt, options) => {
    let sourceDir = options?.sourceDir;
    if (!sourceDir) {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (result.canceled || !result.filePaths?.length) return { canceled: true };
      sourceDir = result.filePaths[0];
    }

    const { dbPath } = require('./database');
    const targetDir = path.dirname(dbPath);
    const dbName = path.basename(dbPath);

    // Stop server + close DB before swapping files
    await stopServerAndDb();

    const candidates = [
      path.join(sourceDir, dbName),
      path.join(sourceDir, 'freight.db')
    ];

    const sourceDb = candidates.find(p => fs.existsSync(p));
    if (!sourceDb) {
      throw new Error('Khong tim thay file freight.db trong thu muc backup da chon');
    }

    safeMkdirp(targetDir);

    const restoreFiles = [
      { src: sourceDb, dst: path.join(targetDir, dbName) },
      { src: path.join(sourceDir, `${path.basename(sourceDb)}-wal`), dst: path.join(targetDir, `${dbName}-wal`) },
      { src: path.join(sourceDir, `${path.basename(sourceDb)}-shm`), dst: path.join(targetDir, `${dbName}-shm`) }
    ];

    for (const f of restoreFiles) {
      if (fs.existsSync(f.src)) {
        fs.copyFileSync(f.src, f.dst);
      }
    }

    // Relaunch to re-open DB cleanly
    app.relaunch();
    app.exit(0);
    return { ok: true };
  });
}

// Khởi động Express server
async function startServer() {
  try {
    console.log('Dang khoi dong server...');

    // Ensure DB lives in a writable, user-scoped folder for packaged installs
    if (!process.env.FREIGHT_DB_DIR) {
      process.env.FREIGHT_DB_DIR = app.getPath('userData');
    }
    
    // Import server module
    const { startServerInstance } = require('./server');
    
    // Khởi động server và đợi hoàn tất
    server = await startServerInstance();
    
    console.log('Server da san sang!');

    // IPC handlers depend on DB being initialized with correct path
    registerIpcHandlers();
    startAutoBackupScheduler();
    
  } catch (err) {
    console.error('Loi khoi dong server:', err);
    throw err;
  }
}

// Tạo cửa sổ app
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    title: 'Freight Manager - Quan ly van chuyen'
  });

  // Load ứng dụng
  mainWindow.loadURL('http://localhost:3000').catch(err => {
    console.error('Khong the load ung dung:', err);
  });
  
  // Xử lý khi load thất bại
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Load that bai:', errorDescription);
    setTimeout(() => {
      console.log('Thu load lai...');
      mainWindow.loadURL('http://localhost:3000');
    }, 1000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Khởi động ứng dụng
app.whenReady().then(async () => {
  try {
    console.log('==========================================');
    console.log('  FREIGHT MANAGER - KHOI DONG UNG DUNG  ');
    console.log('==========================================');
    
    await startServer();
    
    console.log('Mo cua so ung dung...');
    createWindow();
    
    console.log('==========================================');
    console.log('   UNG DUNG DA KHOI DONG THANH CONG    ');
    console.log('==========================================');
    
  } catch (err) {
    console.error('KHONG THE KHOI DONG:', err);
    dialog.showErrorBox('Loi khoi dong', 
      'Khong the khoi dong ung dung!\n\n' + 
      'Chi tiet loi:\n' + err.message + '\n\n' +
      'Vui long lien he ho tro ky thuat.');
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Tắt server khi đóng app
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (server) {
    console.log('Dang dung server...');
    server.close();
  }
});
