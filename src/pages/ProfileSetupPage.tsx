// LifeOS — Profile Setup Page (/social/profile)

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { useUserStore } from '../stores/useUserStore';
import { ProfileSetup } from '../components/social/ProfileSetup';
import '../components/social/social.css';

export function ProfileSetupPage() {
  const user = useUserStore(s => s.user);
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Back button */}
      <button
        onClick={() => navigate('/social')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', color: '#9CA3AF',
          cursor: 'pointer', fontSize: 14, marginBottom: 20,
          padding: '6px 0',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        <ArrowLeft size={16} />
        Back to Community
      </button>

      <div style={{
        fontFamily: 'Orbitron, monospace',
        fontSize: 20,
        fontWeight: 700,
        color: '#00D4FF',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <User size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Public Profile
      </div>

      <ProfileSetup
        userId={user.id}
        onSaved={() => {
          // Navigate back after a brief delay so the user sees the success state
          setTimeout(() => navigate('/social'), 1200);
        }}
      />
    </div>
  );
}

export default ProfileSetupPage;
