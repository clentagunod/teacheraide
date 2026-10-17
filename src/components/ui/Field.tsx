import { useId, type ReactNode } from 'react';

interface InputA11yProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  /** Render prop: spread the received props onto the actual input/select/textarea. */
  children: (props: InputA11yProps) => ReactNode;
}

/** Label + control + error/hint wiring (ids, aria-invalid, aria-describedby) in one place. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-msg`;
  const message = error ?? hint;
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': message ? messageId : undefined })}
      {message && (
        <p id={messageId} className={error ? 'field__error' : 'field__hint'} role={error ? 'alert' : undefined}>
          {message}
        </p>
      )}
    </div>
  );
}
