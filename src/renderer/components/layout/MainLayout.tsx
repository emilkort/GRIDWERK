import Sidebar from './Sidebar'
import TopBar from './TopBar'
import NowPlayingBar from './NowPlayingBar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen flex bg-base overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-base">
        <TopBar />
        <main className="flex-1 overflow-auto px-10 py-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
        <NowPlayingBar />
      </div>
    </div>
  )
}
