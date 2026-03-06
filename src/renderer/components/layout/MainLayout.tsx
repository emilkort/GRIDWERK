import Sidebar from './Sidebar'
import TopBar from './TopBar'
import NowPlayingBar from './NowPlayingBar'
import LogViewer from '@/components/shared/LogViewer'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen flex bg-base overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-base">
        <TopBar />
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto px-10 py-8" id="main-scroll">
            <div className="max-w-[1400px] mx-auto h-full">
              {children}
            </div>
          </div>
        </main>
        <NowPlayingBar />
      </div>
      <LogViewer />
    </div>
  )
}
