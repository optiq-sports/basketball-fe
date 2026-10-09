import { z } from 'zod';
import type { ClientCreate } from '../../types/api';
import { EMAIL_RE, HTTP_URL_RE, optionalMatching, requiredText, zodErrors } from '../../lib/form';

export interface ClientFormValues {
  name: string;
  websiteUrl: string;
  logo: string;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
}

export const EMPTY_CLIENT_FORM: ClientFormValues = {
  name: '',
  websiteUrl: '',
  logo: '',
  userEmail: '',
  userFirstName: '',
  userLastName: '',
};

export type ClientFormErrors = Partial<Record<keyof ClientFormValues, string>>;

/** The new-client form's rules. The primary user is created with the client, so all three of their fields are required. */
export const clientFormSchema: z.ZodType<ClientFormValues, ClientFormValues> = z.object({
  name: requiredText('Enter the client’s name.'),
  websiteUrl: optionalMatching(HTTP_URL_RE, 'Start with http:// or https://'),
  logo: optionalMatching(HTTP_URL_RE, 'Start with http:// or https://'),
  userEmail: z.string().trim().min(1, 'Enter the primary user’s email.').regex(EMAIL_RE, 'Enter a valid email address.'),
  userFirstName: requiredText('Enter their first name.'),
  userLastName: requiredText('Enter their last name.'),
});

/** Field errors for the new-client form. An empty object means the form can be submitted. */
export const validateClientForm = (values: ClientFormValues): ClientFormErrors => zodErrors(clientFormSchema, values);

/** Trims values and drops optional blanks, so the request only carries what was actually entered. */
export function toClientCreate(values: ClientFormValues): ClientCreate {
  const body: ClientCreate = {
    name: values.name.trim(),
    userEmail: values.userEmail.trim(),
    userFirstName: values.userFirstName.trim(),
    userLastName: values.userLastName.trim(),
  };
  if (values.websiteUrl.trim()) body.websiteUrl = values.websiteUrl.trim();
  if (values.logo.trim()) body.logo = values.logo.trim();
  return body;
}
