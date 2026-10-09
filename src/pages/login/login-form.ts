import { z } from 'zod';
import { EMAIL_RE } from '../../lib/form';

export interface LoginFormValues {
  email: string;
  password: string;
}

/** Sign-in needs an email that looks like one and a password; the server decides if they are right. */
export const loginFormSchema: z.ZodType<LoginFormValues, LoginFormValues> = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').regex(EMAIL_RE, 'Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
