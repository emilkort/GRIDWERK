import { Toaster } from 'sonner'
import MainLayout from '@/components/layout/MainLayout'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import CommandPalette from '@/components/shared/CommandPalette'
import DawHubPage from '@/components/daw-hub/DawHubPage'
import VstManagerPage from '@/components/vst-manager/VstManagerPage'
import SampleLibraryPage from '@/components/sample-library/SampleLibraryPage'
import ProjectTrackerPage from '@/components/project-tracker/ProjectTrackerPage'
import OrganiserPage from '@/components/organiser/OrganiserPage'
import AnalyticsPage from '@/components/analytics/AnalyticsPage'
import RecommendationsPage from '@/components/recommendations/RecommendationsPage'
import SettingsPage from '@/components/settings/SettingsPage'
import { useUiStore } from '@/stores/ui.store'

function App(): JSX.Element {
  const currentPage = useUiStore((s) => s.currentPage)
  const theme = useUiStore((s) => s.theme)

  const renderPage = () => {
    switch (currentPage) {
      case 'daw-hub':
        return <DawHubPage />
      case 'vst-manager':
        return <VstManagerPage />
      case 'sample-library':
        return <SampleLibraryPage />
      case 'project-tracker':
        return <ProjectTrackerPage />
      case 'organiser':
        return <OrganiserPage />
      case 'analytics':
        return <AnalyticsPage />
      case 'recommendations':
        return <RecommendationsPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DawHubPage />
    }
  }

  return (
    <ErrorBoundary>
      <MainLayout>
        <ErrorBoundary>
          {renderPage()}
        </ErrorBoundary>
      </MainLayout>
      <CommandPalette />
      <Toaster
        theme={theme}
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            fontFamily: 'Space Mono, monospace',
          }
        }}
      />
    </ErrorBoundary>
  )
}

export default App
