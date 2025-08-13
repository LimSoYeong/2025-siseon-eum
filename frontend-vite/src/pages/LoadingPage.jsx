// LoadingPage.js

import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import UIButton from '../components/common/UIButton';

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

      // 전송 직전 진단 로그
      try {
        const imgType = imageBlob?.type;
        const imgSizeMB = imageBlob ? (imageBlob.size / (1024 * 1024)).toFixed(2) : 'N/A';
        const cap = location.state?.captureInfo || {};
        const width = cap.width || 'unknown';
        const height = cap.height || 'unknown';
        const ua = navigator.userAgent;
        console.log('[Upload Debug] type:', imgType, 'size(MB):', imgSizeMB, 'frame:', `${width}x${height}`, 'UA:', ua, 'source:', cap.source || 'unknown');
      } catch {}

      const formData = new FormData();
      formData.append('image', imageBlob, 'photo.jpg');

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
