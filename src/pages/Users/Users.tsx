import React from 'react';
import { useProfile } from '../../api/hooks';

/**
 * Users management page.
 * Note: The Basketball Management API (Postman collection) does not include user CRUD endpoints.
 * Only auth (register, login, profile) is available. User management requires a separate backend API.
 */
const Users: React.FC = () => {
  const profileQuery = useProfile();
  const profileData = profileQuery.data as { email?: string; role?: string } | undefined;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Users</h1>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-amber-900 mb-2">Users API Not Available</h2>
        <p className="text-amber-800 text-sm leading-relaxed">
          The Basketball Management API does not include user management endpoints. The current backend
          supports <strong>Authentication</strong> (register, login, profile), <strong>Players</strong>,{' '}
          <strong>Teams</strong>, <strong>Tournaments</strong>, and <strong>Matches</strong>.
        </p>
        <p className="text-amber-800 text-sm mt-3">
          To enable user management, the backend would need to expose endpoints such as GET/POST/PATCH/DELETE{' '}
          <code className="bg-amber-100 px-1 rounded">/users</code>.
        </p>
        {profileData && (
          <div className="mt-4 pt-4 border-t border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Logged in as:</strong> {profileData.email ?? '—'} ({profileData.role ?? '—'})
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Users;
