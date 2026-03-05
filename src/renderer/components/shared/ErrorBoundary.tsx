import { ErrorBoundary as REB, type FallbackProps } from 'react-error-boundary'
import type { ReactNode } from 'react'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-white text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-gray-400 text-sm mb-4 max-w-md">{error?.message || 'An unexpected error occurred'}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/80 transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export default function ErrorBoundary({ children, fallback }: Props) {
  return (
    <REB
      FallbackComponent={fallback ? () => <>{fallback}</> : ErrorFallback}
      onError={(error, info) => console.error('ErrorBoundary caught:', error, info)}
    >
      {children}
    </REB>
  )
}
