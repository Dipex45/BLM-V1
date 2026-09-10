import { useEffect, useRef, useState } from "react";

type Tone = "success" | "error" | "info";
type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "url";
  initialValue?: string;
  required?: boolean;
};

export function useAdminFeedback() {
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    requireReason: boolean;
    tone: "primary" | "danger";
  } | null>(null);
  const [reason, setReason] = useState("");
  const confirmationResolver = useRef<((value: string | null) => void) | null>(
    null,
  );
  const [formDialog, setFormDialog] = useState<{
    title: string;
    submitLabel: string;
    fields: FormField[];
  } | null>(null);
  const formResolver = useRef<
    ((value: Record<string, string> | null) => void) | null
  >(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string, tone: Tone = "info") =>
    setToast({ message, tone });

  const confirmAction = (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    requireReason?: boolean;
    tone?: "primary" | "danger";
  }) =>
    new Promise<string | null>((resolve) => {
      confirmationResolver.current = resolve;
      setReason("");
      setConfirmation({
        confirmLabel: "Confirm",
        requireReason: false,
        tone: "primary",
        ...options,
      });
    });

  const requestForm = (options: {
    title: string;
    submitLabel?: string;
    fields: FormField[];
  }) =>
    new Promise<Record<string, string> | null>((resolve) => {
      formResolver.current = resolve;
      setFormDialog({ submitLabel: "Add", ...options });
    });

  const closeConfirmation = (value: string | null) => {
    confirmationResolver.current?.(value);
    confirmationResolver.current = null;
    setConfirmation(null);
  };

  const closeForm = (value: Record<string, string> | null) => {
    formResolver.current?.(value);
    formResolver.current = null;
    setFormDialog(null);
  };

  const feedbackLayer = (
    <>
      {toast && (
        <div
          className={`fixed right-4 top-24 z-[110] max-w-sm rounded-lg border px-4 py-3 text-sm font-semibold shadow-xl ${toast.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : toast.tone === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-outline bg-white text-on-surface"}`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      {confirmation && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-confirm-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeConfirmation(null);
          }}
        >
          <div className="w-full max-w-md rounded-lg border border-outline bg-white p-5 shadow-2xl">
            <h2 id="admin-confirm-title" className="text-lg font-bold">
              {confirmation.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              {confirmation.message}
            </p>
            {confirmation.requireReason && (
              <label className="mt-4 block text-sm font-semibold">
                Reason required
                <textarea
                  autoFocus
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1.5 w-full resize-none rounded-md border border-outline bg-surface-container p-3 text-sm"
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => closeConfirmation(null)}
                className="h-10 rounded-md border border-outline px-4 text-sm font-bold hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                autoFocus={!confirmation.requireReason}
                type="button"
                disabled={
                  confirmation.requireReason && reason.trim().length < 3
                }
                onClick={() => closeConfirmation(reason.trim())}
                className={`h-10 rounded-md px-4 text-sm font-bold text-white disabled:opacity-40 ${confirmation.tone === "danger" ? "bg-red-700 hover:bg-red-800" : "bg-primary hover:bg-primary-container"}`}
              >
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {formDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-form-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeForm(null);
          }}
        >
          <form
            className="w-full max-w-lg rounded-lg border border-outline bg-white p-5 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              const values: Record<string, string> = {};
              new FormData(event.currentTarget).forEach((value, key) => {
                values[key] = String(value);
              });
              closeForm(values);
            }}
          >
            <h2 id="admin-form-title" className="text-lg font-bold">
              {formDialog.title}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {formDialog.fields.map((field, index) => (
                <label key={field.name} className="block text-sm font-semibold">
                  {field.label}
                  <input
                    autoFocus={index === 0}
                    name={field.name}
                    type={field.type || "text"}
                    step={field.type === "number" ? "any" : undefined}
                    required={field.required !== false}
                    defaultValue={field.initialValue}
                    className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => closeForm(null)}
                className="h-10 rounded-md border border-outline px-4 text-sm font-bold hover:bg-surface-container"
              >
                Cancel
              </button>
              <button className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container">
                {formDialog.submitLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );

  return { notify, confirmAction, requestForm, feedbackLayer };
}
