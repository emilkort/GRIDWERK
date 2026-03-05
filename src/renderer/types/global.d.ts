import type { ProducerApi } from '../../preload/api'

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send(channel: string, ...args: any[]): void
        invoke(channel: string, ...args: any[]): Promise<any>
        on(channel: string, listener: (...args: any[]) => void): void
        removeListener(channel: string, listener: (...args: any[]) => void): void
      }
    }
    api: ProducerApi
  }
}
