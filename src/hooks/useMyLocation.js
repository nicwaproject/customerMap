import { useEffect, useRef, useState } from 'react'

const ERROR_MESSAGES = {
  1: 'Izin lokasi ditolak. Izinkan akses lokasi di pengaturan browser, lalu coba lagi.',
  2: 'Lokasi belum tersedia. Pastikan GPS aktif, lalu coba lagi.',
  3: 'Pencarian lokasi terlalu lama. Silakan coba lagi.',
}

export function useMyLocation() {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const pendingRef = useRef(null)
  const requestIdRef = useRef(0)

  useEffect(() => () => {
    // getCurrentPosition cannot be cancelled; ignore callbacks after unmount.
    requestIdRef.current += 1
    pendingRef.current?.resolve(null)
    pendingRef.current = null
  }, [])

  function requestLocation() {
    if (pendingRef.current) return pendingRef.current.promise
    setError(null)
    if (window.isSecureContext === false) {
      setError('Lokasi memerlukan HTTPS atau localhost. Buka aplikasi melalui koneksi aman.')
      return Promise.resolve(null)
    }
    if (!navigator.geolocation) {
      setError('Browser ini tidak mendukung pencarian lokasi.')
      return Promise.resolve(null)
    }

    let resolveRequest
    const promise = new Promise((resolve) => { resolveRequest = resolve })
    pendingRef.current = { promise, resolve: resolveRequest }
    setLoading(true)
    const requestId = ++requestIdRef.current
    const fail = (error) => {
      if (requestIdRef.current !== requestId) return
      pendingRef.current = null
      resolveRequest(null)
      setLoading(false)
      setError(ERROR_MESSAGES[error?.code] ?? 'Gagal mendapatkan lokasi. Silakan coba lagi.')
    }

    try {
      navigator.geolocation.getCurrentPosition((position) => {
        if (requestIdRef.current !== requestId) return
        const { latitude, longitude, accuracy } = position?.coords ?? {}
        if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
            !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
            !Number.isFinite(accuracy) || accuracy < 0) {
          fail({ code: 2 })
          return
        }
        pendingRef.current = null
        setLoading(false)
        const nextLocation = { latitude, longitude, accuracy }
        setLocation(nextLocation)
        resolveRequest(nextLocation)
      }, fail, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
    } catch (error) {
      fail(error)
    }
    return promise
  }

  return { location, loading, error, requestLocation }
}
