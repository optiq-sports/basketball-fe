import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

/**
 * `/tournaments/:id/schedules` used to be its own page: a second list of the same games, with its group
 * tabs filtering nothing. Fixtures does all of it properly (create, edit, status, statistician, delete), so
 * the old address, which people have bookmarked, now lands there.
 */
const SchedulesRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/tournaments/${id}/fixtures`} replace />;
};

export default SchedulesRedirect;
