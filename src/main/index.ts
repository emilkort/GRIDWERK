import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './services/database.service'
import { destroyAnalysisWorker } from './services/audio-analysis.service'
import { registerAllIpcHandlers } from './ipc'
import { startWatchingAllDaws, stopAllWatchers } from './services/project-watcher.service'
import { startWatchingAllVstPaths, stopAllVstWatchers } from './services/vst-watcher.service'
import { startAllServiceWatchers, stopAllServiceWatchers } from './services/service-watcher.service'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    x: 100,
    y: 100,
    show: true,
    center: true,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !process.env['ELECTRON_RENDERER_URL']
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load:', code, desc)
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer process gone:', details.reason, details.exitCode)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.moveTop()
  })

  // Open devtools only in dev mode
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'bottom' })
  }

  return mainWindow
}

// Intercept console.log/warn/error and forward to renderer for the in-app log viewer
function setupLogForwarding(win: BrowserWindow): void {
  const origLog = console.log
  const origWarn = console.warn
  const origError = console.error

  function forward(level: string, args: any[]): void {
    try {
      if (win && !win.isDestroyed()) {
        const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
        win.webContents.send('main:log', { level, message, timestamp: Date.now() })
      }
    } catch { /* swallow */ }
  }

  console.log = (...args: any[]) => { origLog.apply(console, args); forward('info', args) }
  console.warn = (...args: any[]) => { origWarn.apply(console, args); forward('warn', args) }
  console.error = (...args: any[]) => { origError.apply(console, args); forward('error', args) }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.gridwerk')

  // Initialize database
  initDatabase()

  const mainWindow = createWindow()

  // Forward main process logs to renderer
  setupLogForwarding(mainWindow)

  // Register all IPC handlers
  registerAllIpcHandlers(mainWindow)

  // Start watching registered DAW project folders for live sync
  startWatchingAllDaws(mainWindow)

  // Start watching VST scan paths for automatic plugin detection
  startWatchingAllVstPaths(mainWindow)

  // Start watching Splice/Tracklib download folders
  startAllServiceWatchers(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopAllWatchers()
  stopAllVstWatchers()
  stopAllServiceWatchers()
  destroyAnalysisWorker()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
