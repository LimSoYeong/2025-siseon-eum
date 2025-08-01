// LoadingPage.js

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function LoadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const imageBlob = location.state?.imageBlob;
  const serverUrl = process.env.REACT_APP_API_SERVER_URL;

  useEffect(() => {
    const analyzeImage = async () => {

      if (!imageBlob) {
        alert('이미지를 불러올 수 없습니다.');
        navigate('/camera');
        return;
      }

      const formData = new FormData();
      formData.append('image', imageBlob, 'photo.jpg');

      console.log('[Debug] FormData:', formData.get('file')); // ✅ 확인

      try {
        const response = await axios.post(
          `${serverUrl}/api/describe`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );

        // ✅ 결과 받아서 summary 페이지로 이동
        const summaryText = response.data.result;
        sessionStorage.setItem('userInteracted', 'true');  // ✅ 사용자 인터랙션 기록
        navigate('/summary', { state: { summary: summaryText } });
      } catch (error) {
        console.error('서버 요청 실패:', error);
        alert('문서 분석에 실패했습니다.');
        navigate('/camera');
      }
    };

    analyzeImage();
  }, [navigate, imageBlob]);

  return (
    <div style={styles.container}>
      <div style={styles.spinner}></div>
      <div style={styles.text}>잠시만 기다려주세요</div>
      <div style={styles.subtext}>문서 분석중...</div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center',
    background: '#fff',
  },
  spinner: {
    width: 48,
    height: 48,
    border: '5px solid #ccc',
    borderTop: '5px solid #333',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: 20,
  },
  text: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  subtext: { fontSize: 16, color: '#666' },
};

// CSS 애니메이션 추가
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes spin {
  0% { transform: rotate(0deg);}
  100% { transform: rotate(360deg);}
}`;
document.head.appendChild(styleSheet);