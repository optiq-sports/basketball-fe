import { z } from 'zod';

export interface ChangePasswordFormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const MIN_NEW_PASSWORD_LENGTH = 6;

/**
 * The rules for changing a password, shared by the forced-change screen and the account page. These are
 * a convenience; the server checks again.
 */
export const changePasswordSchema: z.ZodType<ChangePasswordFormValues, ChangePasswordFormValues> = z
  .object({
    oldPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(1, 'Choose a new password.')
      .min(MIN_NEW_PASSWORD_LENGTH, `At least ${MIN_NEW_PASSWORD_LENGTH} characters.`),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword && v.oldPassword && v.newPassword === v.oldPassword) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Choose a password different from your current one.' });
    }
    if (v.confirmPassword !== v.newPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: "Doesn't match the new password." });
    }
  });
