import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './services/database.service'
import { destroyAnalysisWorker } from './services/audio-analysis.service'
import { registerAllIpcHandlers } from './ipc'
import { startWatchingAllDaws, stopAllWatchers } from './services/project-watcher.service'

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
      webSecurity: false
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

app.whenReady().then(() => {
  app.setAppUserModelId('com.gridwerk')

  // Initialize database
  initDatabase()

  const mainWindow = createWindow()

  // Register all IPC handlers
  registerAllIpcHandlers(mainWindow)

  // Start watching registered DAW project folders for live sync
  startWatchingAllDaws(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopAllWatchers()
  destroyAnalysisWorker()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
