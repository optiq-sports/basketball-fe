# Seed credentials and login

Use these credentials to sign in after the backend has the users created.

## Logins

| Role        | Email                        | Password      |
|------------|------------------------------|---------------|
| Super Admin | `superadmin@optiqsports.com` | `superadmin123` |
| Admin       | `admin@optiqsports.com`      | `admin123`      |

The login page **Quick Login** buttons use these same emails and passwords.

## Creating the users (backend)

The Basketball Management API uses `POST /api/auth/register`. Create the users there (or via a backend seed).

**Super Admin** (register first if your API supports a super-admin role):

- Email: `superadmin@optiqsports.com`
- Password: `superadmin123`
- Role: use whatever your API expects for super admin (e.g. `ADMIN` if that’s the highest role)

**Admin:**

- Email: `admin@optiqsports.com`
- Password: `admin123`
- Role: `ADMIN`

**Statistician (optional):**

- Email: `statistician@optiqsports.com`
- Password: `statistician123`
- Role: `STATISTICIAN`

If your backend has a seed script, add these same emails/passwords (and roles) so you can use the Quick Login buttons without registering manually.
