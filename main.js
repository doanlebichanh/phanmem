const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

let mainWindow;
let server;

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
