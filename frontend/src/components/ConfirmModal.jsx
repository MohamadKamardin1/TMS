import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from './ui';

/**
 * Purpose-built confirmation dialog for irreversible / consequential actions
 * (confirming a delivery, deactivating an account, discarding a draft). Renders
 * the trigger label with either a danger or a primary action, disables the
 * confirm button while `confirming` and calls `onConfirm` on submit.
 */
export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary', // 'primary' | 'danger'
  icon,
  confirming = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;
  const ConfirmBtn = tone === 'danger' ? BTN_DANGER : BTN_PRIMARY;
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {icon || <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-gray-600">{message}</p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={confirming} className={BTN_SECONDARY}>
              {cancelLabel}
            </button>
            <button type="button" onClick={onConfirm} disabled={confirming} className={ConfirmBtn}>
              {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
