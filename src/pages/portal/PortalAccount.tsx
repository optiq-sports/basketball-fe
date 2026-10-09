import React from 'react';
import { useProfile } from '../../api/hooks';
import { PageHeader } from '../../components/admin/page-states';
import ChangePasswordForm from '../../components/account/ChangePasswordForm';
import { Card, CardDescription, CardTitle } from '../../components/ui/primitives/card';

const PortalAccount: React.FC = () => {
  const profile = useProfile();
  const user = profile.data as { email?: string; name?: string | null } | undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account" description="Your sign-in details." />

      <Card>
        <CardTitle>Signed in as</CardTitle>
        <CardDescription>{user?.name ? `${user.name} · ` : ''}{user?.email ?? '—'}</CardDescription>
      </Card>

      <Card className="max-w-md">
        <CardTitle>Change password</CardTitle>
        <CardDescription>Use at least 6 characters.</CardDescription>
        <ChangePasswordForm onChanged={() => undefined} />
      </Card>
    </div>
  );
};

export default PortalAccount;
