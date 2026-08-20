import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function VerifyRedirect(): JSX.Element | null {
  const { assetId } = useParams<{ assetId: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!assetId) return
    // redirect to /verify with query param and also include state so PublicVerifyView can read from history.state
    navigate(`/verify?assetId=${encodeURIComponent(assetId)}`, { replace: true, state: { assetId } })
  }, [assetId, navigate])

  return null
}
