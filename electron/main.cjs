// Veronis desktop shell — deliberately minimal attack surface:
// the renderer is a fully local, offline app with no Node access.
const { app, BrowserWindow, Menu, session } = require('electron')
const path = require('path')

// One instance only — a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f9f9f7',
    autoHideMenuBar: true,
    webPreferences: {
      // Security posture: the renderer runs as an untrusted web page.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  })

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

  // The app needs no device/system permissions — deny everything.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// No window may open popups or navigate away from the bundled app.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault()
  })
  contents.session.setPermissionCheckHandler(() => false)
})

app.on('window-all-closed', () => {
  app.quit()
})
