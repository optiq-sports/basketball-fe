import { z, type ZodType } from 'zod';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;

/**
 * Runs a schema on its own, without a form. The first message for each field wins, so the result has
 * the same shape the hand-written validators returned and anything that read them keeps working. The
 * dialogs use the same schemas through React Hook Form's `zodResolver`.
 */
export function zodErrors<T extends object>(schema: ZodType<T, T>, values: T): FieldErrors<T> {
  const result = schema.safeParse(values);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors as FieldErrors<T>;
}

/** A required text field: trimmed, and an error when it is blank. */
export const requiredText = (message: string) => z.string().trim().min(1, message);

/** A text field that may be blank but, when filled, must match. */
export const optionalMatching = (re: RegExp, message: string) =>
  z.string().trim().refine((v) => !v || re.test(v), message);
