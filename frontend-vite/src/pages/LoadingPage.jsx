// // LoadingPage.js

// import React, { useEffect, useRef } from 'react';
// import { useNavigate, useLocation } from 'react-router-dom';
// import axios from 'axios';
// import UIButton from '../components/common/UIButton';

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

//       // 전송 직전 진단 로그
//       try {
//         const imgType = imageBlob?.type;
//         const imgSizeMB = imageBlob ? (imageBlob.size / (1024 * 1024)).toFixed(2) : 'N/A';
//         const cap = location.state?.captureInfo || {};
//         const width = cap.width || 'unknown';
//         const height = cap.height || 'unknown';
//         const ua = navigator.userAgent;
//         console.log('[Upload Debug] type:', imgType, 'size(MB):', imgSizeMB, 'frame:', `${width}x${height}`, 'UA:', ua, 'source:', cap.source || 'unknown');
//       } catch {}

//       const formData = new FormData();
//       formData.append('image', imageBlob, 'photo.jpg');

//       try {
//         const response = await axios.post(
//           `${apiUrl}/api/start_session`,
//           formData,
//           {
//             headers: { 'Content-Type': 'multipart/form-data' },
//             withCredentials: true,
//           }
//         );

//         const summaryText = response.data.answer;
//         const docId = response.data.doc_id;
//         sessionStorage.setItem('userInteracted', 'true');
//         navigate('/summary', { state: { summary: summaryText, docId }, replace: true });
//       } catch (error) {
//         console.error('서버 요청 실패:', error);
//         alert('문서 분석에 실패했습니다.');
//         navigate('/camera');
//       }
//     };

//     if (!LoadingPage.__ranOnce) {
//       LoadingPage.__ranOnce = true;
//       analyzeImage();
//       setTimeout(() => { LoadingPage.__ranOnce = false; }, 1000);
//     }
//   }, [apiUrl, navigate, imageBlob]);

//   return (
//     <div className="min-h-screen flex flex-col justify-center items-center bg-white">
//       <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin mb-5"></div>
//       <div className="text-lg font-bold mb-2 text-black">잠시만 기다려주세요</div>
//       <div className="text-base text-black">문서 분석중...</div>
//     </div>
//   );
// }

// src/pages/LoadingPage.jsx Axios빼고 fetch로 변경경
import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL; // e.g., https://siseon-eum.site

export default function LoadingPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const imageBlob = state?.imageBlob;

  // 중복 실행 방지
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      if (!imageBlob) {
        alert('이미지를 불러올 수 없습니다.');
        navigate('/camera', { replace: true });
        return;
      }

      // 전송 직전 진단 로그
      try {
        const imgType = imageBlob?.type;
        const imgSizeMB = imageBlob ? (imageBlob.size / (1024 * 1024)).toFixed(2) : 'N/A';
        const cap = state?.captureInfo || {};
        const width = cap.width || 'unknown';
        const height = cap.height || 'unknown';
        const ua = navigator.userAgent;
        console.log('[Upload Debug] type:', imgType, 'size(MB):', imgSizeMB, 'frame:', `${width}x${height}`, 'UA:', ua, 'source:', cap.source || 'unknown');
      } catch {}

      // Blob → File 보정(JPEG 파일명/타입 보장)
      const file = imageBlob instanceof File
        ? imageBlob
        : new File([imageBlob], 'capture.jpg', { type: 'image/jpeg' });

      // FormData 구성 (❗ Content-Type 헤더 수동 지정 금지)
      const fd = new FormData();
      fd.append('file', file, file.name); // 백엔드가 'image' 키면 여기만 'image'로 변경

      try {
        const res = await fetch(`${API_BASE}/api/start_session`, {
          method: 'POST',
          body: fd,
          credentials: 'include', // 쿠키 인증 안 쓰면 이 줄 제거
        });

        const text = await res.text().catch(() => '');
        if (!res.ok) throw new Error(`start_session ${res.status} ${text}`);

        let data = {};
        try { data = JSON.parse(text); } catch {}

        const summaryText = data.answer ?? data.summary ?? '';
        const docId = data.doc_id ?? data.id ?? null;

        sessionStorage.setItem('userInteracted', 'true');
        navigate('/summary', { state: { summary: summaryText, docId, session: data }, replace: true });
      } catch (error) {
        console.error('서버 요청 실패:', error);
        alert('문서 분석에 실패했습니다. 다시 시도해 주세요.');
        navigate('/camera', { replace: true });
      } finally {
        // 1초 후 다시 시도 가능 상태로 (필요 시)
        setTimeout(() => { ranRef.current = false; }, 1000);
      }
    })();
  }, [imageBlob, navigate, state]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white">
      <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin mb-5"></div>
      <div className="text-lg font-bold mb-2 text-black">잠시만 기다려주세요</div>
      <div className="text-base text-black">문서 분석중...</div>
    </div>
  );
}

