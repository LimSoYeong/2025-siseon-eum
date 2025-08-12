//CameraScreen.jsx 해상도 + 초점 맞추기 기능 코드 

// src/pages/CameraScreen.jsx
import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UIButton from '../components/common/UIButton';

export default function CameraScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const imageCaptureRef = useRef(null);

  const [focusUI, setFocusUI] = useState(null);     // { xPx, yPx } 탭 포커스 링 표시
  const [vsize, setVsize] = useState({ w: 0, h: 0 }); // 현재 입력 해상도 표시용
  const navigate = useNavigate();

  // 카메라 시작
  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' }, // 후면 선호
            width:  { ideal: 2560 },              // 가능하면 더 높은 해상도 시도
            height: { ideal: 1440 },
            frameRate: { ideal: 30 },
          },
        });

        if (!mounted) return;
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        // 해상도 capability 기반 재적용(가능한 범위 내 최대)
        try {
          const caps = track.getCapabilities?.();
          if (caps?.width && caps?.height) {
            const targetW = Math.min(2560, caps.width.max ?? 2560);
            const targetH = Math.min(1440, caps.height.max ?? 1440);
            await track.applyConstraints({ advanced: [{ width: targetW, height: targetH }] });
          }
        } catch {}

        // ImageCapture 준비(지원되는 브라우저에서)
        try {
          if ('ImageCapture' in window && typeof ImageCapture === 'function') {
            imageCaptureRef.current = new ImageCapture(track);
          }
        } catch {}

        // 자동 초점(가능 시)
        try {
          const caps = track.getCapabilities?.();
          if (caps?.focusMode) {
            if (caps.focusMode.includes('continuous')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
            } else if (caps.focusMode.includes('auto')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'auto' }] });
            }
          }
          if (imageCaptureRef.current?.getPhotoCapabilities) {
            const pc = await imageCaptureRef.current.getPhotoCapabilities();
            if (pc?.focusMode?.includes?.('continuous')) {
              await imageCaptureRef.current.setOptions({ focusMode: 'continuous' });
            }
          }
        } catch {}

        // 비디오 연결 및 해상도 메타 갱신
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.playsInline = true;
          const onLoaded = () => setVsize({ w: video.videoWidth, h: video.videoHeight });
          video.addEventListener('loadedmetadata', onLoaded, { once: true });
          await video.play().catch(() => {});
        }
      } catch (err) {
        console.error('camera start failed', err);
        alert('카메라 권한이 없거나 접근 실패');
      }
    };

    startCamera();

    return () => {
      mounted = false;
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    };
  }, []);

  // 탭해서 초점 맞추기(지원되는 기기/브라우저에서 동작)
  const handleTapFocus = async (e) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = video.getBoundingClientRect();
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    const normX = (cx - rect.left) / rect.width;   // 0~1
    const normY = (cy - rect.top) / rect.height;   // 0~1

    // 화면 포커스 링 표시
    setFocusUI({ xPx: cx - rect.left, yPx: cy - rect.top });
    setTimeout(() => setFocusUI(null), 900);

    const track = trackRef.current;

    // 1) ImageCapture 우선
    try {
      if (imageCaptureRef.current?.setOptions) {
        await imageCaptureRef.current.setOptions({
          pointsOfInterest: [{ x: normX, y: normY }], // 일부 브라우저에서만
          focusMode: 'single-shot',
        });
        return;
      }
    } catch (err) {
      console.debug('ImageCapture.setOptions failed', err);
    }

    // 2) 트랙 제약으로 시도
    try {
      if (track?.applyConstraints) {
        const caps = track.getCapabilities?.();
        await track.applyConstraints({
          advanced: [
            {
              pointsOfInterest: [{ x: normX, y: normY }],
              ...(caps?.focusMode?.includes?.('single-shot') ? { focusMode: 'single-shot' } : {}),
              ...(caps?.focusMode?.includes?.('continuous') ? { focusMode: 'continuous' } : {}),
            },
          ],
        });
      }
    } catch (err) {
      console.debug('track.applyConstraints focus failed', err);
    }
  };

  // 촬영: ImageCapture(풀해상도) → 캔버스 폴백
  const takePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState < 2) {
      alert('카메라가 아직 준비되지 않았습니다');
      return;
    }

    // 1) ImageCapture 우선(가능 시 풀해상도 스틸)
    try {
      if (imageCaptureRef.current?.takePhoto) {
        const blob = await imageCaptureRef.current.takePhoto();
        if (blob) {
          navigate('/load', { state: { imageBlob: blob } });
          return;
        }
      }
    } catch (err) {
      console.debug('ImageCapture.takePhoto failed, fallback to canvas', err);
    }

    // 2) 캔버스 폴백(현재 프레임 실제 해상도)
    try {
      const track = trackRef.current;
      const settings = track?.getSettings?.() ?? {};
      const w = settings.width || video.videoWidth || 1280;
      const h = settings.height || video.videoHeight || 720;

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
      if (blob) {
        navigate('/load', { state: { imageBlob: blob } });
      } else {
        alert('이미지 캡처 실패. 다시 시도해주세요.');
      }
    } catch (err) {
      console.error('canvas capture failed', err);
      alert('이미지 캡처 실패. 다시 시도해주세요.');
    }
  };

  const goBack = () => navigate('/home', { replace: true });

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black">
      {/* 카메라 미리보기 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover touch-manipulation"
        onPointerDown={handleTapFocus}
        onTouchStart={handleTapFocus} // 일부 iOS 호환
      />

      {/* 탭 포커스 링 */}
      {focusUI && (
        <div
          className="pointer-events-none absolute border-2 border-yellow-400 rounded-full transition-opacity duration-300"
          style={{
            width: 64,
            height: 64,
            left: focusUI.xPx - 32,
            top: focusUI.yPx - 32,
            boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* 현재 입력 해상도 뱃지(확인용) */}
      <div className="absolute bottom-2 right-2 text-[11px] bg-black/60 text-white px-2 py-1 rounded z-10">
        {vsize.w}×{vsize.h}
      </div>

      {/* 캡처용 캔버스(숨김) */}
      <canvas ref={canvasRef} width="360" height="640" className="hidden" />

      {/* ← 뒤로가기 */}
      <UIButton
        onClick={goBack}
        className="absolute top-5 left-5 px-4 py-2 text-white text-base rounded-md z-10 bg-black/40"
      >
        ← 뒤로가기
      </UIButton>

      {/* ● 촬영 버튼 */}
      <UIButton
        aria-label="촬영"
        onClick={takePhoto}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90px] h-[90px] rounded-full bg-white border-[4px] border-gray-300 z-10"
      />
    </div>
  );
}
