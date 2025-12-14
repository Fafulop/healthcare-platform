// Root page - API status endpoint
export default function HomePage() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Healthcare API</h1>
      <p>Backend API is running.</p>
      <h2>Available Endpoints:</h2>
      <ul>
        <li><code>GET /api/doctors</code> - List all doctors</li>
        <li><code>GET /api/doctors/[slug]</code> - Get doctor by slug</li>
        <li><code>POST /api/doctors</code> - Create new doctor (admin only)</li>
      </ul>
      <p style={{ marginTop: '2rem', color: '#666' }}>
        Port: 3003 | Environment: {process.env.NODE_ENV}
      </p>
    </div>
  );
}
