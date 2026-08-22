export type CertChainRefreshType = 'inventory' | 'marketplace' | 'auctions' | 'all'

const EVENT_NAME = 'certchain:data-refresh'

export function triggerDataRefresh(type: CertChainRefreshType = 'all') {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: { type },
  }))
}

export function subscribeToDataRefresh(
  handler: (type: CertChainRefreshType) => void,
  allowedTypes: CertChainRefreshType[] = ['all', 'inventory', 'marketplace', 'auctions'],
) {
  if (typeof window === 'undefined') return () => {}

  const listener = (event: Event) => {
    const type = (event as CustomEvent<{ type?: CertChainRefreshType }>).detail?.type || 'all'
    if (allowedTypes.includes(type) || allowedTypes.includes('all')) {
      handler(type)
    }
  }

  window.addEventListener(EVENT_NAME, listener as EventListener)
  return () => window.removeEventListener(EVENT_NAME, listener as EventListener)
}
