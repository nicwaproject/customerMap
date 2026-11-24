import CustomerServiceWorkspace from './workspaces/CustomerServiceWorkspace.jsx'
import BacaMeterWorkspace from './workspaces/BacaMeterWorkspace.jsx'

const WORKSPACES = [
  { id: 'cs', label: 'Customer Service' },
  { id: 'baca-meter', label: 'Baca Meter' },
]

export default function Sidebar({ open, onClose, onLogout, activeWorkspace, onWorkspaceChange, bacaMeter, ...customerServiceProps }) {

  function handleTabKeyDown(event) {
    const currentIndex = WORKSPACES.findIndex(({ id }) => id === activeWorkspace)
    let nextIndex
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % WORKSPACES.length
        break
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + WORKSPACES.length) % WORKSPACES.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = WORKSPACES.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    onWorkspaceChange(WORKSPACES[nextIndex].id)
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[nextIndex].focus()
  }

  return (
    <aside
      className={[
        'pointer-events-auto fixed inset-x-0 bottom-0 z-[1000]',
        'h-[min(88dvh,720px)] w-full max-w-none rounded-t-2xl border-t bg-white shadow-2xl',
        'sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[380px] sm:max-w-[86vw] sm:rounded-none sm:border-l sm:border-t-0',
        'md:w-[420px] lg:w-[360px]',
        'transition-transform duration-300 ease-out',
        open ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full sm:translate-y-0',
      ].join(' ')}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-4">
          <div className="min-w-0">
            <div className="text-base font-bold leading-5 text-slate-900">
              Customer Map
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Dashboard peta distribusi pelanggan air
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-slate-200 px-4 py-3">
          <div
            role="tablist"
            aria-label="Workspace"
            className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
          >
            {WORKSPACES.map((workspace) => (
              <button
                key={workspace.id}
                id={`workspace-tab-${workspace.id}`}
                type="button"
                role="tab"
                aria-selected={activeWorkspace === workspace.id}
                aria-controls={`workspace-panel-${workspace.id}`}
                tabIndex={activeWorkspace === workspace.id ? 0 : -1}
                onClick={() => onWorkspaceChange(workspace.id)}
                onKeyDown={handleTabKeyDown}
                className={[
                  'min-w-0 rounded-lg px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                  activeWorkspace === workspace.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800',
                ].join(' ')}
              >
                {workspace.label}
              </button>
            ))}
          </div>
        </div>

        {/* Keep panels mounted to preserve controls and scroll position. */}
        {WORKSPACES.map((workspace) => (
          <div
            key={workspace.id}
            id={`workspace-panel-${workspace.id}`}
            role="tabpanel"
            aria-labelledby={`workspace-tab-${workspace.id}`}
            hidden={activeWorkspace !== workspace.id}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
          >
            {workspace.id === 'cs' ? (
              <CustomerServiceWorkspace {...customerServiceProps} />
            ) : (
              <BacaMeterWorkspace {...bacaMeter} />
            )}
          </div>
        ))}

        <div className="shrink-0 border-t border-slate-200 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 text-xs text-slate-500">
          <p>Sidebar ini overlay di atas peta (map tetap full view).</p>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
