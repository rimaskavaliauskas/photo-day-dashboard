import { fetchMyPlaces, fetchVideos, fetchDashboard, DashboardData } from '@/lib/api';
import { MyPlacesPage } from '@/components/MyPlacesPage';

// Disable caching for this page - always fetch fresh data
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Fetch data from worker (server-side)
  let myPlaces;
  let videos;
  let dashboardData: DashboardData | null = null;
  let error: string | null = null;

  try {
    const dashboardPromise = fetchDashboard();
    [myPlaces, videos] = await Promise.all([
      fetchMyPlaces(),
      fetchVideos(),
    ]);
    dashboardData = await dashboardPromise;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load dashboard';
    console.error('Dashboard fetch error:', err);
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">📷</div>
        <h2 className="error-title">Unable to Load Dashboard</h2>
        <p className="error-message">
          {error || 'Failed to fetch data from the backend. Make sure the worker is running.'}
        </p>
        <p className="error-url">
          Worker URL: {process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'}
        </p>
      </div>
    );
  }

  return (
    <MyPlacesPage
      initialPlaces={myPlaces || []}
      initialVideos={videos || []}
      nearbyPlaces={dashboardData?.places || []}
      currentLocation={dashboardData?.location}
    />
  );
}
