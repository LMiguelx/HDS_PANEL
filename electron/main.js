const { app, BrowserWindow } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: { contextIsolation: true }
  });

  win.loadFile(
    path.join(__dirname, '../dist/hdsapp-frontend/browser/index.html')
  );
}

app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged) {
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
});

app.on('window-all-closed', () => app.quit());
