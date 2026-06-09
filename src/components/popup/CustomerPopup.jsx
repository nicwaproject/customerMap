import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { getCustomerStatusMeta } from '../../utils/customerStatus'

function StatusBadge({ status }) {
  const statusMeta = getCustomerStatusMeta(status)
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1',
        statusMeta.badgeClass,
      ].join(' ')}
    >
      {status ?? '-'}
    </span>
  )
}

async function copyText(value) {
  const text = String(value ?? '').trim()
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(input)
  return copied
}

export default function CustomerPopup({ customer }) {
  const [copiedCustomerId, setCopiedCustomerId] = useState(null)

  if (!customer) return null
  const lat = Number(customer.latitude)
  const lng = Number(customer.longitude)
  const customerId = customer.id ?? customer.no_langganan ?? ''
  const copied = Boolean(customerId) && copiedCustomerId === String(customerId)
  const mapsHref =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : null

  return (
    <div className="min-w-[240px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-900">
            {customer.nama ?? '-'}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="min-w-0 truncate text-xs text-slate-600">
              {customerId || '-'}
            </div>
            {customerId && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation()
                  const ok = await copyText(customerId)
                  if (!ok) return
                  setCopiedCustomerId(String(customerId))
                  window.setTimeout(() => setCopiedCustomerId(null), 1400)
                }}
                className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                aria-label="Copy ID pelanggan"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Tersalin' : 'Copy'}
              </button>
            )}
          </div>
        </div>
        <StatusBadge status={customer.status} />
      </div>

      <div className="mt-2 space-y-1 text-sm text-slate-700">
        <div className="leading-snug">{customer.alamat ?? '-'}</div>
        {(customer.kelurahan || customer.kecamatan) && (
          <div className="text-xs text-slate-600">
            {[customer.kelurahan, customer.kecamatan].filter(Boolean).join(' • ')}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
        <div className="rounded-lg bg-slate-50 px-2 py-2 ring-1 ring-slate-200">
          <div className="text-[11px] text-slate-500">Pembaca meter</div>
          <div className="mt-0.5 font-medium">
            {customer.pembaca_meter ?? '-'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2 ring-1 ring-slate-200">
          <div className="text-[11px] text-slate-500">Golongan</div>
          <div className="mt-0.5 font-medium">{customer.golongan ?? '-'}</div>
        </div>
      </div>

      {mapsHref && (
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Arahkan ke Google Maps
        </a>
      )}
    </div>
  )
}
