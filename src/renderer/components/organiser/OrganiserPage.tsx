import { useEffect, useState } from 'react'
import { useCollectionStore } from '@/stores/collection.store'
import CollectionList from './CollectionList'
import CollectionDetail from './CollectionDetail'
import SuggestionSidebar from './SuggestionSidebar'

export default function OrganiserPage() {
  const { selectedCollectionId, fetchCollections } = useCollectionStore()
  const [initialLoad, setInitialLoad] = useState(false)

  useEffect(() => {
    if (!initialLoad) {
      fetchCollections()
      setInitialLoad(true)
    }
  }, [initialLoad, fetchCollections])

  return (
    <div className="flex h-full overflow-hidden -mx-10 -my-8" style={{ width: 'calc(100% + 5rem)', height: 'calc(100% + 4rem)' }}>
      {/* Left: Collection list */}
      <CollectionList />

      {/* Center: Selected collection detail */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedCollectionId ? (
          <CollectionDetail />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <svg className="w-12 h-12 mx-auto text-text-darker" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
              </svg>
              <p className="text-text-dark text-[13px] font-medium">Select or create a collection</p>
              <p className="text-text-darker text-[11px]">Organise your songs into albums, EPs, and singles</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Suggestions sidebar */}
      {selectedCollectionId && <SuggestionSidebar />}
    </div>
  )
}
