import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth.js';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#080e1a',
        color: '#38bdf8',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(56, 189, 248, 0.2)',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '16px',
        }}></div>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>Verifying secure session...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
