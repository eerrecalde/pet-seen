import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Ignores stale async QR results when a poster URL changes or unmounts. */
export function useQrCode(url: string) {
  const [qrCode, setQrCode] = useState('')
  useEffect(() => {
    let cancelled = false
    setQrCode('')
    void QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
    })
      .then((dataUrl) => {
        if (!cancelled) setQrCode(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrCode('')
      })
    return () => {
      cancelled = true
    }
  }, [url])
  return qrCode
}
