// // LoadingPage.js

// import React, { useEffect, useRef } from 'react';
// import { useNavigate, useLocation } from 'react-router-dom';
// import axios from 'axios';

// export default function LoadingPage() {
//   const navigate = useNavigate();
//   const location = useLocation();
//   const imageBlob = location.state?.imageBlob;
//   const apiUrl = import.meta.env.VITE_API_URL;

//   useEffect(() => {
//     const ranRef = useRef || null;
//     const analyzeImage = async () => {

//       if (!imageBlob) {
//         alert('이미지를 불러올 수 없습니다.');
//         navigate('/camera');
//         return;
//       }

//       const formData = new FormData();
//       formData.append('image', imageBlob, 'photo.jpg');

//       console.log('[Debug] FormData:', formData.get('image'));

//       try {
//         const response = await axios.post(
//           `${apiUrl}/api/start_session`,
//           formData,
//           { 
//             headers: { 'Content-Type': 'multipart/form-data' },
//             withCredentials: true // 쿠키 저장 허용
//           }
//         );

//         //  결과 받아서 summary 페이지로 이동 (히스토리 정리: /load를 대체)
//         const summaryText = response.data.answer;
//         const docId = response.data.doc_id;
//         sessionStorage.setItem('userInteracted', 'true');  //  사용자 인터랙션 기록
//         navigate('/summary', { state: { summary: summaryText, docId }, replace: true });
//       } catch (error) {
//         console.error('서버 요청 실패:', error);
//         alert('문서 분석에 실패했습니다.');
//         navigate('/camera');
//       }
//     };

//     // StrictMode 이중 호출 방지: 1회 가드
//     if (!LoadingPage.__ranOnce) {
//       LoadingPage.__ranOnce = true;
//       analyzeImage();
//       // 1초 후 해제하여 다른 세션에서는 다시 동작
//       setTimeout(() => { LoadingPage.__ranOnce = false; }, 1000);
//     }
//   }, [apiUrl, navigate, imageBlob]);

//   return (
//     <div style={styles.container}>
//       <div style={styles.spinner}></div>
//       <div style={styles.text}>잠시만 기다려주세요</div>
//       <div style={styles.subtext}>문서 분석중...</div>
//     </div>
//   );
// }

// const styles = {
//   container: {
//     minHeight: '100vh',
//     display: 'flex', flexDirection: 'column',
//     justifyContent: 'center', alignItems: 'center',
//     background: 'var(--bg-color)',
//   },
//   spinner: {
//     width: 48,
//     height: 48,
//     border: '5px solid #ccc',
//     borderTop: '5px solid #333',
//     borderRadius: '50%',
//     animation: 'spin 1s linear infinite',
//     marginBottom: 20,
//   },
//   text: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
//   subtext: { fontSize: 16 },
// };

// // CSS 애니메이션 추가
// const styleSheet = document.createElement("style");
// styleSheet.innerText = `
// @keyframes spin {
//   0% { transform: rotate(0deg);}
//   100% { transform: rotate(360deg);}
// }`;
// document.head.appendChild(styleSheet);

import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function LoadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const imageBlob = location.state?.imageBlob;
  const apiUrl = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const ranRef = useRef || null;
    const analyzeImage = async () => {
      if (!imageBlob) {
        alert('이미지를 불러올 수 없습니다.');
        navigate('/camera');
        return;
      }

      const formData = new FormData();
      formData.append('image', imageBlob, 'photo.jpg');

      console.log('[Debug] FormData:', formData.get('image'));

      try {
        const response = await axios.post(
          `${apiUrl}/api/start_session`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            withCredentials: true,
          }
        );

        const summaryText = response.data.answer;
        const docId = response.data.doc_id;
        sessionStorage.setItem('userInteracted', 'true');
        navigate('/summary', { state: { summary: summaryText, docId }, replace: true });
      } catch (error) {
        console.error('서버 요청 실패:', error);
        alert('문서 분석에 실패했습니다.');
        navigate('/camera');
      }
    };

    if (!LoadingPage.__ranOnce) {
      LoadingPage.__ranOnce = true;
      analyzeImage();
      setTimeout(() => { LoadingPage.__ranOnce = false; }, 1000);
    }
  }, [apiUrl, navigate, imageBlob]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white dark:bg-black">
      <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin mb-5"></div>
      <div className="text-lg font-bold mb-2">잠시만 기다려주세요</div>
      <div className="text-base">문서 분석중...</div>
    </div>
  );
}
