import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    // 1.5초 후 /start(시작화면)으로 이동
    const timeout = setTimeout(() => {
      navigate('/home');
    }, 1500);
    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>시선이음</h1>
      <div style={styles.subtitle}>보는 것에서, 이해로. 시선을 잇다.</div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    maxWidth: 400,
    minHeight: '80vh',
    margin: '40px auto',
    // border: '4px solid #eee',  // 회색 테두리
    borderRadius: 18,
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '38px 0'
  },
  title: {
    fontSize: 32,    // (로그인 시안 기준이면 32~36)
    fontWeight: 700,
    margin: '18px 0 30px 0',
    letterSpacing: '-2px',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16
  }
};
