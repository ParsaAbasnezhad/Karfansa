import { useEffect, useRef } from 'react'
import { Icon } from '@/features/home/icons'
import { installationInstructions } from './installationInstructions'

interface Props {
  onClose: () => void
}

export default function InstallDialog({ onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const instructions = installationInstructions()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    closeRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="pwa-dialog"
      dir="rtl"
      aria-labelledby="pwa-dialog-title"
      aria-describedby="pwa-dialog-description"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="pwa-dialog-head">
        <img src="/icons/icon-192.png" width="56" height="56" alt="" />
        <button
          ref={closeRef}
          type="button"
          className="pwa-dialog-close"
          aria-label="بستن راهنمای نصب"
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>
      <p className="pwa-eyebrow">کارفنسا، همیشه همراه شما</p>
      <h2 id="pwa-dialog-title">{instructions.title}</h2>
      <p id="pwa-dialog-description">{instructions.description}</p>
      {instructions.steps.length > 0 && (
        <ol className="pwa-install-steps">
          {instructions.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      <button type="button" className="pwa-primary-action" onClick={onClose}>
        متوجه شدم
      </button>
    </dialog>
  )
}
