import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function StartPage() {
  const navigate = useNavigate();

  // 로그인 버튼 클릭시 홈으로 이동
  const handleLogin = () => {
    navigate('/home');
  };

  return (
    <div style={styles.container}>
      <div style={{ fontSize: 15, color: "#666", marginBottom: 16 }}>
        노인 친화형 문서이해 서비스
      </div>
      <div style={styles.title}>시선이음</div>
      <button style={styles.kakao} onClick={handleLogin}>
        카카오로 계속하기
      </button>
      <button style={styles.google} onClick={handleLogin}>
        구글로 계속하기
      </button>
      <button style={styles.naver} onClick={handleLogin}>
        네이버로 계속하기
      </button>
    </div>
  );
}

const styles = {
  container: {
    width: 320, minHeight: '80vh',
    margin: '40px auto',
    border: '4px solid #eee',
    borderRadius: 18,
    background: '#fff',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    boxSizing: 'border-box', padding: '38px 0'
  },
  title: {
    fontSize: 32, fontWeight: 700,
    margin: '18px 0 30px 0', textAlign: 'center'
  },
  kakao: {
    background: '#FEE500', color: '#000',
    width: 240, height: 46, border: 'none', borderRadius: 8, fontWeight: 600,
    fontSize: 16, margin: '10px 0', cursor: 'pointer'
  },
  google: {
    background: '#fff', color: '#444',
    width: 240, height: 46, border: '1px solid #ddd', borderRadius: 8, fontWeight: 600,
    fontSize: 16, margin: '10px 0', cursor: 'pointer'
  },
  naver: {
    background: '#03C75A', color: '#fff',
    width: 240, height: 46, border: 'none', borderRadius: 8, fontWeight: 600,
    fontSize: 16, margin: '10px 0', cursor: 'pointer'
  }
};
