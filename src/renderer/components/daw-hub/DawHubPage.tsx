import { useEffect, useState } from 'react'
import { useDawStore } from '@/stores/daw.store'
import DawCard from './DawCard'
import RegisterDawDialog from './RegisterDawDialog'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'

export default function DawHubPage() {
  const { daws, projects, loading, fetchDaws, fetchProjects } = useDawStore()
  const [registerOpen, setRegisterOpen] = useState(false)

  useEffect(() => {
    fetchDaws()
  }, [fetchDaws])

  // Fetch projects for all DAWs once they're loaded
  useEffect(() => {
    for (const daw of daws) {
      if (!projects[daw.id]) {
        fetchProjects(daw.id)
      }
    }
  }, [daws, projects, fetchProjects])

  if (loading && daws.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-[0.05em] uppercase">DAW Hub</h1>
          <p className="text-text-muted text-[11px] mt-1.5 tracking-wider uppercase">
            Manage your digital audio workstations and project files
          </p>
        </div>
        <button
          onClick={() => setRegisterOpen(true)}
          className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-red-600 text-white text-[11px] font-bold uppercase tracking-widest transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Register DAW
        </button>
      </div>

      {/* Content */}
      {daws.length === 0 ? (
        <EmptyState
          title="No DAWs registered"
          description="Register your digital audio workstations to manage project files, launch your DAW, and scan for projects."
          action={{
            label: 'Register DAW',
            onClick: () => setRegisterOpen(true)
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {daws.map((daw) => (
            <DawCard
              key={daw.id}
              daw={daw}
              projects={projects[daw.id] || []}
            />
          ))}
        </div>
      )}

      {/* Register Dialog */}
      <RegisterDawDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
      />
    </div>
  )
}
