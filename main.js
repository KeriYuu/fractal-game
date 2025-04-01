// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
    });

    // Load our index.html into the window
    win.loadFile('index.html');

    // Open DevTools for debugging
    win.webContents.openDevTools();
}

// Create window when app is ready
app.whenReady().then(() => {
    createWindow();

    // On macOS, re-create a window when the dock icon is clicked if no other windows are open
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Quit when all windows are closed (not on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});