/**
 * App-wide feedback: toast notifications, a loading overlay and a promise-based
 * confirmation dialog. Only ONE toast is shown at a time so `toast-success` /
 * `toast-error` are always unique on the page.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button, Field, Spinner, TextArea } from './index';
import { Modal } from './Modal';

// ------------------------------------------------------------------ toast
type ToastKind = 'success' | 'error' | 'info';
interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

// ------------------------------------------------------------------ confirm
export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  variant?: 'primary' | 'danger' | 'success' | 'warning';
  /** Ask for remarks; when `remarksRequired` they must be at least 5 characters. */
  remarks?: boolean;
  remarksRequired?: boolean;
  remarksLabel?: string;
}
interface ConfirmResult {
  confirmed: boolean;
  remarks: string;
}

interface FeedbackApi {
  toast: (kind: ToastKind, message: string) => void;
  /** Shows the loading overlay for a fixed 300 ms, then runs `fn`. Deterministic by design. */
  withLoading: <T>(fn: () => T) => Promise<T>;
  confirm: (opts: ConfirmOptions) => Promise<ConfirmResult>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);
export const LOADING_DELAY_MS = 300;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [loading, setLoading] = useState(0);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (r: ConfirmResult) => void }) | null>(null);
  const [remarks, setRemarks] = useState('');
  const [remarksError, setRemarksError] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    window.clearTimeout(timer.current);
    seq.current++;
    setToast({ id: seq.current, kind, message });
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 8000 : 6000);
  }, []);

  const withLoading = useCallback(<T,>(fn: () => T) => {
    setLoading((n) => n + 1);
    return new Promise<T>((resolve, reject) => {
      window.setTimeout(() => {
        try {
          resolve(fn());
        } catch (e) {
          reject(e);
        } finally {
          setLoading((n) => n - 1);
        }
      }, LOADING_DELAY_MS);
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setRemarks('');
    setRemarksError('');
    return new Promise<ConfirmResult>((resolve) => setConfirmState({ ...opts, resolve }));
  }, []);

  const closeConfirm = (confirmed: boolean) => {
    if (!confirmState) return;
    if (confirmed && confirmState.remarksRequired && remarks.trim().length < 5) {
      setRemarksError(`${confirmState.remarksLabel ?? 'Remarks'} is required (min 5 characters)`);
      return;
    }
    confirmState.resolve({ confirmed, remarks: remarks.trim() });
    setConfirmState(null);
  };

  const toastColors: Record<ToastKind, string> = {
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    error: 'border-rose-300 bg-rose-50 text-rose-900',
    info: 'border-sky-300 bg-sky-50 text-sky-900',
  };

  return (
    <FeedbackContext.Provider value={{ toast: showToast, withLoading, confirm }}>
      {children}

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2" data-testid="toast-container">
        {toast && (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            data-testid={`toast-${toast.kind}`}
            className={`pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-lg ${toastColors[toast.kind]}`}
          >
            <span className="flex-1" data-testid="toast-message">
              {toast.message}
            </span>
            <button type="button" className="text-xs font-semibold opacity-70 hover:opacity-100" data-testid="toast-close-btn" aria-label="Dismiss notification" onClick={() => setToast(null)}>
              ✕
            </button>
          </div>
        )}
      </div>

      {loading > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/50" data-testid="loading-overlay" aria-busy="true">
          <div className="flex items-center gap-2 rounded-md bg-white px-4 py-3 text-sm text-slate-700 shadow-lg" data-testid="loading-spinner">
            <Spinner className="text-teal-700" /> Processing...
          </div>
        </div>
      )}

      <Modal
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        testId="confirm-dialog"
        onClose={() => closeConfirm(false)}
        footer={
          <>
            <Button variant="secondary" testId="confirm-no-btn" onClick={() => closeConfirm(false)}>
              Cancel
            </Button>
            <Button variant={confirmState?.variant ?? 'primary'} testId="confirm-yes-btn" onClick={() => closeConfirm(true)}>
              {confirmState?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-slate-700" data-testid="confirm-dialog-message">
          {confirmState?.message}
        </div>
        {confirmState?.remarks && (
          <Field id="confirm-remarks" label={confirmState.remarksLabel ?? 'Remarks'} required={confirmState.remarksRequired} error={remarksError} className="mt-3">
            <TextArea
              id="confirm-remarks"
              value={remarks}
              invalid={!!remarksError}
              onChange={(e) => {
                setRemarks(e.target.value);
                setRemarksError('');
              }}
            />
          </Field>
        )}
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider');
  return ctx;
}
