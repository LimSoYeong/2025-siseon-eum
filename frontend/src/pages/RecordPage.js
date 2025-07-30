import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function RecordPage() {
  const navigate = useNavigate();

  const handleStopRecording = () => {
    navigate('/answer');
  };

  return (
    <div style={styles.container}>
      <div style={styles.text}>🎤 음성 질문 녹음 중...</div>
      <button style={styles.button} onClick={handleStopRecording}>
        녹음 종료
      </button>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center',
    background: '#fff'
  },
  text: { fontSize: 20, marginBottom: 20 },
  button: {
    fontSize: 18,
    padding: '12px 32px',
    borderRadius: 10,
    border: 'none',
    background: '#222',
    color: '#fff',
    cursor: 'pointer'
  }
};
