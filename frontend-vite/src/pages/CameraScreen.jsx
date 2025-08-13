// // src/pages/CameraScreen.jsx
// import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
// import { useNavigate } from 'react-router-dom';
// import UIButton from '../components/common/UIButton';

// export default function CameraScreen() {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);

//   const streamRef = useRef(null);
//   const trackRef = useRef(null);
//   const imageCaptureRef = useRef(null);

//   const [focusUI, setFocusUI] = useState(null); // { xPx, yPx }
//   const [vsize, setVsize] = useState({ w: 0, h: 0 });
//   const [focusSupported, setFocusSupported] = useState(false); // (기기/브라우저) 초점 제어 지원 여부
//   const [toast, setToast] = useState('');
//   const navigate = useNavigate();

//   // 모바일 판정(터치+뷰포트+UA 혼합)
//   const isMobile = useMemo(() => {
//     const ua = navigator.userAgent || '';
//     const mobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
//     const touch = (navigator.maxTouchPoints || 0) > 0;
//     const small = Math.min(window.innerWidth, window.innerHeight) < 820;
//     const isWindows = /Windows NT/i.test(ua);
//     return mobileUA || (touch && small && !isWindows);
//   }, []);

//   // “웹상에선 링 미지원” 규칙 반영 → 링 활성 조건
//   const focusRingEnabled = isMobile && focusSupported;

//   const showToast = useCallback((msg, ms = 2000) => {
//     setToast(msg);
//     if (ms) setTimeout(() => setToast(''), ms);
//   }, []);

  

//   const startCamera = useCallback(async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: false,
//         video: {
//           facingMode: { ideal: 'environment' },
//           width: { ideal: 2560 },
//           height: { ideal: 1440 },
//           frameRate: { ideal: 30 },
//         },
//       });

//       streamRef.current = stream;
//       const track = stream.getVideoTracks()[0];
//       trackRef.current = track;

//       // 가능한 최대 해상도로 상향
//       try {
//         const caps = track.getCapabilities?.();
//         if (caps?.width && caps?.height) {
//           const targetW = Math.min(2560, caps.width.max ?? 2560);
//           const targetH = Math.min(1440, caps.height.max ?? 1440);
//           await track.applyConstraints({ advanced: [{ width: targetW, height: targetH }] });
//         }
//       } catch {}

//       // ImageCapture 준비
//       try {
//         if ('ImageCapture' in window && typeof ImageCapture === 'function') {
//           imageCaptureRef.current = new ImageCapture(track);
//         }
//       } catch {}

//       // 자동초점 기본 적용(가능 시)
//       try {
//         const caps = track.getCapabilities?.();
//         if (caps?.focusMode) {
//           if (caps.focusMode.includes('continuous')) {
//             await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
//           } else if (caps.focusMode.includes('auto')) {
//             await track.applyConstraints({ advanced: [{ focusMode: 'auto' }] });
//           }
//         }
//         if (imageCaptureRef.current?.getPhotoCapabilities) {
//           const pc = await imageCaptureRef.current.getPhotoCapabilities();
//           if (pc?.focusMode?.includes?.('continuous')) {
//             await imageCaptureRef.current.setOptions({ focusMode: 'continuous' });
//           }
//         }
//       } catch {}

//       // 초점 제어 지원성 감지
//       try {
//         const caps = track.getCapabilities?.();
//         const supported =
//           !!(caps && (caps.focusMode || caps.pointsOfInterest)) ||
//           !!(imageCaptureRef.current && imageCaptureRef.current.setOptions);
//         setFocusSupported(Boolean(supported));
        
//       } catch {}

//       // 비디오 연결/표시
//       const video = videoRef.current;
//       if (video) {
//         video.srcObject = stream;
//         video.playsInline = true;
//         const onLoaded = () => setVsize({ w: video.videoWidth, h: video.videoHeight });
//         video.addEventListener('loadedmetadata', onLoaded, { once: true });
//         await video.play().catch(() => {});
//       }
//     } catch (err) {
//       console.error('camera start failed', err);
//       alert('카메라 권한이 없거나 접근 실패');
//     }
//   }, []);

//   // 시작/정리
//   useEffect(() => {
//     startCamera();
//     return () => {
//       streamRef.current?.getTracks()?.forEach((t) => t.stop());
//     };
//   }, [startCamera]);

//   // 탭 포커스: 데스크톱에선 아무 것도 안 함. 모바일에서만 동작.
//   const handleTapFocus = async (e) => {
//     if (!isMobile) return; // 규칙 1: 웹에선 링/포커스 비활성

//     const video = videoRef.current;
//     if (!video) return;

//     // 모바일 + 미지원이면 아무 동작도 하지 않음(네이티브 호출 제거)
//     if (!focusSupported) return;

//     // (모바일 + 지원) → 링 표시 + 포커스 시도
//     const rect = video.getBoundingClientRect();
//     const cx = e.clientX ?? e.touches?.[0]?.clientX;
//     const cy = e.clientY ?? e.touches?.[0]?.clientY;
//     const normX = (cx - rect.left) / rect.width;
//     const normY = (cy - rect.top) / rect.height;

//     setFocusUI({ xPx: cx - rect.left, yPx: cy - rect.top });
//     setTimeout(() => setFocusUI(null), 900);

//     // ImageCapture 우선 → 트랙 제약
//     try {
//       if (imageCaptureRef.current?.setOptions) {
//         await imageCaptureRef.current.setOptions({
//           pointsOfInterest: [{ x: normX, y: normY }],
//           focusMode: 'single-shot',
//         });
//         return;
//       }
//     } catch {}

//     try {
//       const track = trackRef.current;
//       const caps = track?.getCapabilities?.();
//       await track?.applyConstraints?.({
//         advanced: [
//           {
//             pointsOfInterest: [{ x: normX, y: normY }],
//             ...(caps?.focusMode?.includes?.('single-shot') ? { focusMode: 'single-shot' } : {}),
//             ...(caps?.focusMode?.includes?.('continuous') ? { focusMode: 'continuous' } : {}),
//           },
//         ],
//       });
//     } catch {}
//   };

//   // 재초점(스트림 재시작)
//   const refocusTrick = async () => {
//     try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch {}
//     await startCamera();
//     showToast('재초점 시도 중...');
//   };

  

//   // 촬영: ImageCapture → 캔버스 폴백
//   const takePhoto = async () => {
//     const video = videoRef.current;
//     const canvas = canvasRef.current;
//     if (!video || !canvas) return;
//     if (video.readyState < 2) { alert('카메라가 아직 준비되지 않았습니다'); return; }

//     try {
//       if (imageCaptureRef.current?.takePhoto) {
//         const blob = await imageCaptureRef.current.takePhoto();
//         if (blob) {
//           navigate('/load', { state: { imageBlob: blob, captureInfo: { source: 'imageCapture' } } });
//           return;
//         }
//       }
//     } catch {}

//     try {
//       const track = trackRef.current;
//       const s = track?.getSettings?.() ?? {};
//       const w = s.width || video.videoWidth || 1280;
//       const h = s.height || video.videoHeight || 720;
//       canvas.width = w; canvas.height = h;
//       const ctx = canvas.getContext('2d');
//       ctx.drawImage(video, 0, 0, w, h);
//       const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
//       if (blob) navigate('/load', { state: { imageBlob: blob, captureInfo: { source: 'canvas', width: w, height: h } } });
//       else alert('이미지 캡처 실패. 다시 시도해주세요.');
//     } catch (err) {
//       console.error('canvas capture failed', err);
//       alert('이미지 캡처 실패. 다시 시도해주세요.');
//     }
//   };

//   const goBack = () => navigate('/home', { replace: true });

//   return (
//     <div className="relative w-full h-[100dvh] overflow-hidden bg-black">
//       {/* 카메라 미리보기 */}
//       <video
//         ref={videoRef}
//         autoPlay
//         playsInline
//         className="w-full h-full object-cover touch-manipulation"
//         onPointerDown={handleTapFocus}
//         onTouchStart={handleTapFocus}
//       />

//       {/* 탭 포커스 링: 모바일 + 지원일 때만 */}
//       {focusRingEnabled && focusUI && (
//         <div
//           className="pointer-events-none absolute z-10 border-2 border-yellow-400 rounded-full transition-opacity duration-300"
//           style={{
//             width: 64,
//             height: 64,
//             left: focusUI.xPx - 32,
//             top: focusUI.yPx - 32,
//             boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
//           }}
//         />
//       )}

//       {/* 토스트 */}
//       {toast && (
//         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-3 py-2 rounded z-20">
//           {toast}
//         </div>
//       )}

//       {/* 현재 해상도 뱃지 */}
//       <div className="absolute bottom-2 right-2 text-[11px] bg-black/60 text-white px-2 py-1 rounded z-10">
//         {vsize.w}×{vsize.h}
//       </div>

//       {/* 캡처용 캔버스(숨김) */}
//       <canvas ref={canvasRef} width="360" height="640" className="hidden" />

      

//       {/* ← 뒤로가기 */}
//       <UIButton
//         onClick={goBack}
//         className="absolute top-5 left-5 px-4 py-2 text-white text-base rounded-md z-10 bg-black/40"
//       >
//         ← 뒤로가기
//       </UIButton>

//       {/* ● 촬영 버튼(웹카메라 경로용) */}
//       <UIButton
//         aria-label="촬영"
//         onClick={takePhoto}
//         className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90px] h-[90px] rounded-full bg-white border-[4px] border-gray-300 z-10"
//       />

//       {/* 재초점(스트림 재시작) */}
//       <UIButton
//         onClick={refocusTrick}
//         className="absolute top-5 right-5 px-3 py-2 text-white text-xs rounded-md z-10 bg-black/40"
//       >
//         재초점
//       </UIButton>

      
//     </div>
//   );
// }


//모바일 테스트지 이미지 리사이징 반영 
// src/pages/CameraScreen.jsx
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import UIButton from '../components/common/UIButton';

export default function CameraScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const imageCaptureRef = useRef(null);

  const [focusUI, setFocusUI] = useState(null); // { xPx, yPx }
  const [vsize, setVsize] = useState({ w: 0, h: 0 });
  const [focusSupported, setFocusSupported] = useState(false); // (기기/브라우저) 초점 제어 지원 여부
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  // 촬영 중복 방지
  const isCapturingRef = useRef(false);

  // 모바일 판정(터치+뷰포트+UA 혼합)
  const isMobile = useMemo(() => {
    const ua = navigator.userAgent || '';
    const mobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
    const touch = (navigator.maxTouchPoints || 0) > 0;
    const small = Math.min(window.innerWidth, window.innerHeight) < 820;
    const isWindows = /Windows NT/i.test(ua);
    return mobileUA || (touch && small && !isWindows);
  }, []);

  // “웹상에선 링 미지원” 규칙 반영 → 링 활성 조건
  const focusRingEnabled = isMobile && focusSupported;

  const showToast = useCallback((msg, ms = 2000) => {
    setToast(msg);
    if (ms) setTimeout(() => setToast(''), ms);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
          frameRate: { ideal: 30 },
        },
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // 세부 묘사 힌트
      try { track.contentHint = 'detail'; } catch {}

      // 가능한 최대 해상도로 상향 (모바일 안전 상한 적용)
      try {
        const caps = track.getCapabilities?.();
        if (caps?.width && caps?.height) {
          const targetW = Math.min(2560, caps.width.max ?? 2560);
          const targetH = Math.min(1440, caps.height.max ?? 1440);
          await track.applyConstraints({
            advanced: [
              { width: targetW, height: targetH },
              ...(caps?.resizeMode?.includes?.('none') ? [{ resizeMode: 'none' }] : []),
            ],
          });
        }
      } catch {}

      // ImageCapture 준비 (+ 사진 최대 해상도 적용 시도)
      try {
        if ('ImageCapture' in window && typeof ImageCapture === 'function') {
          imageCaptureRef.current = new ImageCapture(track);
          try {
            const pc = await imageCaptureRef.current.getPhotoCapabilities();
            const maxW = pc?.imageWidth?.max;
            const maxH = pc?.imageHeight?.max;
            if (maxW && maxH) {
              await imageCaptureRef.current.setOptions({ imageWidth: maxW, imageHeight: maxH });
            }
          } catch {}
        }
      } catch {}

      // 자동초점/줌 시도(가능 시)
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
        // 약간 확대(지원 시)로 텍스트 가독성 향상
        try {
          const c = track.getCapabilities?.();
          if (c?.zoom && typeof c.zoom.max === 'number' && typeof c.zoom.min === 'number') {
            const midZoom = Math.min(c.zoom.max, Math.max(c.zoom.min, c.zoom.max * 0.15));
            await track.applyConstraints({ advanced: [{ zoom: midZoom }] });
          }
        } catch {}
      } catch {}

      // 초점 제어 지원성 감지
      try {
        const caps = track.getCapabilities?.();
        const supported =
          !!(caps && (caps.focusMode || caps.pointsOfInterest)) ||
          !!(imageCaptureRef.current && imageCaptureRef.current.setOptions);
        setFocusSupported(Boolean(supported));
      } catch {}

      // 비디오 연결/표시
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
  }, []);

  // 시작/정리
  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    };
  }, [startCamera]);

  // 탭 포커스: 데스크톱에선 아무 것도 안 함. 모바일에서만 동작.
  const handleTapFocus = async (e) => {
    if (!isMobile) return; // 규칙 1: 웹에선 링/포커스 비활성

    const video = videoRef.current;
    if (!video) return;

    // 모바일 + 미지원이면 아무 동작도 하지 않음(네이티브 호출 제거)
    if (!focusSupported) return;

    // (모바일 + 지원) → 링 표시 + 포커스 시도
    const rect = video.getBoundingClientRect();
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    const { x: normX, y: normY } = (() => {
      const elX = cx - rect.left;
      const elY = cy - rect.top;
      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;
      if (!vw || !vh) return { x: 0.5, y: 0.5 };
      const arVideo = vw / vh;
      const arBox = rect.width / rect.height;
      let drawW, drawH, offX, offY;
      if (arVideo > arBox) {
        drawW = rect.height * arVideo;
        drawH = rect.height;
        offX = (rect.width - drawW) / 2;
        offY = 0;
      } else {
        drawW = rect.width;
        drawH = rect.width / arVideo;
        offX = 0;
        offY = (rect.height - drawH) / 2;
      }
      const xInVideo = (elX - offX) / drawW;
      const yInVideo = (elY - offY) / drawH;
      return {
        x: Math.min(1, Math.max(0, xInVideo)),
        y: Math.min(1, Math.max(0, yInVideo)),
      };
    })();

    setFocusUI({ xPx: cx - rect.left, yPx: cy - rect.top });
    setTimeout(() => setFocusUI(null), 900);

    // ImageCapture 우선 → 트랙 제약
    try {
      if (imageCaptureRef.current?.setOptions) {
        await imageCaptureRef.current.setOptions({
          pointsOfInterest: [{ x: normX, y: normY }],
          focusMode: 'single-shot',
        });
        // 약간 대기 후 연속초점 복귀
        setTimeout(async () => {
          try { await imageCaptureRef.current?.setOptions?.({ focusMode: 'continuous' }); } catch {}
        }, 800);
        return;
      }
    } catch {}

    try {
      const track = trackRef.current;
      const caps = track?.getCapabilities?.();
      await track?.applyConstraints?.({
        advanced: [
          {
            pointsOfInterest: [{ x: normX, y: normY }],
            ...(caps?.focusMode?.includes?.('single-shot') ? { focusMode: 'single-shot' } : {}),
            ...(caps?.focusMode?.includes?.('continuous') ? { focusMode: 'continuous' } : {}),
          },
        ],
      });
      if (caps?.focusMode?.includes?.('continuous')) {
        setTimeout(async () => {
          try { await track?.applyConstraints?.({ advanced: [{ focusMode: 'continuous' }] }); } catch {}
        }, 800);
      }
    } catch {}
  };

  // 재초점(스트림 재시작)
  const refocusTrick = async () => {
    try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch {}
    await startCamera();
    showToast('재초점 시도 중...');
  };

  // 촬영: ImageCapture → 캔버스 폴백 (원본 그대로 LoadingPage로 전달)
  const takePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2) { alert('카메라가 아직 준비되지 않았습니다'); return; }

    if (isCapturingRef.current) return;
    isCapturingRef.current = true;

    try {
      // 셔터 전 약간 대기하여 AF가 자리 잡도록 함
      await new Promise((r) => setTimeout(r, 250));

      // 1) ImageCapture가 있으면 우선 사용
      try {
        if (imageCaptureRef.current?.takePhoto) {
          const raw = await imageCaptureRef.current.takePhoto();
          if (raw) {
            navigate('/load', { state: { imageBlob: raw, captureInfo: { source: 'imageCapture' } } });
            return;
          }
        }
      } catch {}

      // 2) 폴백: <video> 프레임을 캔버스로 JPEG 캡처
      try {
        const track = trackRef.current;
        const s = track?.getSettings?.() ?? {};
        const w = s.width || video.videoWidth || 1280;
        const h = s.height || video.videoHeight || 720;
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);
        const raw = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
        if (raw) {
          navigate('/load', { state: { imageBlob: raw, captureInfo: { source: 'canvas', width: w, height: h } } });
        } else {
          alert('이미지 캡처 실패. 다시 시도해주세요.');
        }
      } catch (err) {
        console.error('canvas capture failed', err);
        alert('이미지 캡처 실패. 다시 시도해주세요.');
      }
    } finally {
      // 라우팅으로 언마운트되더라도 안전, 실패 시 재시도 가능하게 해제
      isCapturingRef.current = false;
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
      />

      {/* 탭 포커스 링: 모바일 + 지원일 때만 */}
      {focusRingEnabled && focusUI && (
        <div
          className="pointer-events-none absolute z-10 border-2 border-yellow-400 rounded-full transition-opacity duration-300"
          style={{
            width: 64,
            height: 64,
            left: focusUI.xPx - 32,
            top: focusUI.yPx - 32,
            boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-3 py-2 rounded z-20">
          {toast}
        </div>
      )}

      {/* 현재 해상도 뱃지 */}
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

      {/* ● 촬영 버튼(웹카메라 경로용) */}
      <UIButton
        aria-label="촬영"
        onClick={takePhoto}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90px] h-[90px] rounded-full bg-white border-[4px] border-gray-300 z-10"
      />

      {/* 재초점(스트림 재시작) */}
      <UIButton
        onClick={refocusTrick}
        className="absolute top-5 right-5 px-3 py-2 text-white text-xs rounded-md z-10 bg-black/40"
      >
        재초점
      </UIButton>
    </div>
  );
}


