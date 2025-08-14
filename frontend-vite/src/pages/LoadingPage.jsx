
// src/pages/LoadingPage.jsx
import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMAGE_UPLOAD_CONFIG, API_BASE } from '../config/appConfig';

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

      // ------- 업로드 전 표준화(리사이징+JPEG) -------
      // 목표: 용량 과다/HEIC 등으로 인한 413·처리 실패 방지
      const { MAX_W, MAX_H, JPEG_Q } = IMAGE_UPLOAD_CONFIG;

      // 전송 직전 진단 로그
      try {
        const imgType = imageBlob?.type;
        const imgSizeMB = imageBlob ? (imageBlob.size / (1024 * 1024)).toFixed(2) : 'N/A';
        const cap = state?.captureInfo || {};
        const width = cap.width || 'unknown';
        const height = cap.height || 'unknown';
        const ua = navigator.userAgent;
        console.log(
          '[Upload Debug] type:', imgType,
          'size(MB):', imgSizeMB,
          'frame:', `${width}x${height}`,
          'UA:', ua,
          'source:', cap.source || 'unknown'
        );
      } catch {}

      // Blob/File -> 안전한 JPEG(File)로 변환 (필요 시에만 리사이즈)
      let file;
      try {
        const { width: w, height: h } = await getImageSize(imageBlob);
        const needsResize =
          !w || !h || w > MAX_W || h > MAX_H || imageBlob.type !== 'image/jpeg';

        if (needsResize) {
          file = await toJpegUnderLimit(imageBlob, MAX_W, MAX_H, JPEG_Q);
        } else {
          // 이미 JPEG이고, 크기도 한도 내면 이름만 정규화
          file = imageBlob instanceof File
            ? imageBlob
            : new File([imageBlob], 'capture.jpg', { type: 'image/jpeg' });
        }

        // 리사이즈 후 실제 용량도 한 번 찍어보자
        try {
          console.log('[Upload Debug] after-convert size(MB):', (file.size / (1024 * 1024)).toFixed(2));
        } catch {}
      } catch (e) {
        console.warn('이미지 표준화 실패, 원본으로 시도:', e);
        // 실패 시 최후의 수단: 원본을 JPEG로 감싸서 보냄(서버가 거부할 수 있음)
        file = imageBlob.type === 'image/jpeg'
          ? (imageBlob instanceof File ? imageBlob : new File([imageBlob], 'capture.jpg', { type: 'image/jpeg' }))
          : new File([imageBlob], 'capture.jpg', { type: 'image/jpeg' });
      }

      // FormData 구성 (❗ Content-Type 헤더 수동 지정 금지)
      const fd = new FormData();
      // 백엔드 요구 파라미터명은 'image' (UploadFile 필드명)
      fd.append('image', file, file.name);

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

/* ================= 유틸들 ================= */

// 이미지 크기만 빨리 얻고 싶을 때(성능상 createImageBitmap 우선, 실패 시 <img> 폴백)
async function getImageSize(blob) {
  // 일부 브라우저에서 createImageBitmap가 더 빠르고 EXIF 회전도 반영 가능
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(blob);
      const size = { width: bmp.width, height: bmp.height };
      bmp.close?.();
      return size;
    } catch {}
  }
  // 폴백: HTMLImageElement
  const img = await blobToImage(blob);
  return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

// 어떤 Blob/File이 와도 JPEG(≤maxW×maxH)로 표준화
async function toJpegUnderLimit(input, maxW = 1920, maxH = 1080, quality = 0.85) {
  const img = await blobToImage(input);

  // contain 방식으로 축소(확대는 하지 않음)
  const { w, h } = fitContain(img.naturalWidth || img.width, img.naturalHeight || img.height, maxW, maxH);

  // OffscreenCanvas 가능하면 사용(메인스레드 블로킹 감소), 안 되면 일반 canvas
  const useOffscreen = typeof OffscreenCanvas !== 'undefined';
  const canvas = useOffscreen ? new OffscreenCanvas(w, h) : document.createElement('canvas');

  if (!useOffscreen) {
    canvas.width = w; canvas.height = h;
  } else {
    canvas.width = w; canvas.height = h;
  }

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  // toBlob 대체 (OffscreenCanvas는 convertToBlob)
  let blob;
  if (useOffscreen && 'convertToBlob' in canvas) {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  } else {
    blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
  }

  return new File([blob], 'capture.jpg', { type: 'image/jpeg' });
}

function blobToImage(b) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(b);
    const img = new Image();
    // EXIF 회전 반영: 최신 브라우저는 대부분 from-image 기본 반영
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function fitContain(w, h, maxW, maxH) {
  const r = Math.min(maxW / w, maxH / h, 1);
  return { w: Math.round(w * r), h: Math.round(h * r) };
}


