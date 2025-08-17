//모바일 테스트지 이미지 리사이징 반영 
// src/pages/CameraScreen.jsx
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import UIButton from '../components/common/UIButton';
import { isMobileDevice, CAMERA_CONFIG, API_BASE } from '../config/appConfig';

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
  const [cameraReady, setCameraReady] = useState(false); // 카메라 준비 상태
  const [cameraError, setCameraError] = useState(null); // 카메라 에러 상태
  const navigate = useNavigate();

  // 촬영 중복 방지
  const isCapturingRef = useRef(false);

  // 동적 뷰포트 높이 처리(iOS 주소창 수축/확장 대응)
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined'
      ? Math.round((window.visualViewport?.height || window.innerHeight) || 0)
      : 0
  );
  const updateViewportHeight = useCallback(() => {
    try {
      const h = Math.round((window.visualViewport?.height || window.innerHeight) || 0);
      if (h && h !== viewportH) setViewportH(h);
    } catch {}
  }, [viewportH]);

  // 모바일 판정(터치+뷰포트+UA 혼합)
  const isMobile = useMemo(() => isMobileDevice(), []);

  // “웹상에선 링 미지원” 규칙 반영 → 링 활성 조건
  const focusRingEnabled = isMobile && focusSupported;

  const showToast = useCallback((msg, ms = 2000) => {
    setToast(msg);
    if (ms) setTimeout(() => setToast(''), ms);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setCameraReady(false);
      
      // 기존 스트림이 있으면 먼저 정리
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
      
      // 잠시 대기하여 이전 스트림이 완전히 정리되도록 함
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // PWA 환경에서 카메라 권한 확인
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'camera' });
          if (permission.state === 'denied') {
            const error = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
            setCameraError(error);
            alert(error);
            return;
          }
        } catch (permError) {
          console.warn('Permission query failed:', permError);
        }
      }

      const pref = isMobile ? CAMERA_CONFIG.MOBILE : CAMERA_CONFIG.DESKTOP;
      
      // 더 안정적인 카메라 설정 - 최소값부터 시작
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { min: 640, ideal: Math.min(pref.width, 1920) },
          height: { min: 480, ideal: Math.min(pref.height, 1080) },
          frameRate: { min: 15, ideal: Math.min(pref.frameRate, 30) },
        },
      };

      console.log('Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      console.log('Camera track obtained:', track.getSettings());

      // 비디오 연결/표시를 먼저 수행
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true; // PWA에서 오디오 관련 문제 방지
        video.autoplay = true;
        
        // 비디오 로드 이벤트 처리
        const onLoaded = () => {
          console.log('Video loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
          setVsize({ w: video.videoWidth, h: video.videoHeight });
          setCameraReady(true);
          updateViewportHeight();
        };
        
        const onCanPlay = () => {
          console.log('Video can play');
          if (!cameraReady) {
            setCameraReady(true);
          }
        };
        
        const onError = (e) => {
          console.error('Video error:', e);
          setCameraError('비디오 로드 실패');
        };
        
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('error', onError);
        
        // 비디오 재생 시도
        try {
          await video.play();
          console.log('Video play successful');
        } catch (playError) {
          console.warn('Video play failed, retrying...', playError);
          // 재시도
          setTimeout(async () => {
            try {
              await video.play();
              console.log('Video play retry successful');
            } catch (retryError) {
              console.error('Video play retry failed', retryError);
              setCameraError('비디오 재생에 실패했습니다.');
            }
          }, 1000);
        }
      }

      // 세부 묘사 힌트
      try { 
        track.contentHint = 'detail'; 
        console.log('Content hint set to detail');
      } catch (e) {
        console.warn('Failed to set content hint:', e);
      }

      // ImageCapture 준비
      try {
        if ('ImageCapture' in window && typeof ImageCapture === 'function') {
          imageCaptureRef.current = new ImageCapture(track);
          console.log('ImageCapture initialized');
        }
      } catch (e) {
        console.warn('ImageCapture initialization failed:', e);
      }

      // 초점 제어 지원성 감지
      try {
        const caps = track.getCapabilities?.();
        const supported =
          !!(caps && (caps.focusMode || caps.pointsOfInterest)) ||
          !!(imageCaptureRef.current && imageCaptureRef.current.setOptions);
        setFocusSupported(Boolean(supported));
        console.log('Focus supported:', supported);
      } catch (e) {
        console.warn('Focus capability check failed:', e);
        setFocusSupported(false);
      }

    } catch (err) {
      console.error('camera start failed', err);
      setCameraReady(false);
      
      // 더 구체적인 에러 메시지
      let errorMessage = '카메라 접근 실패';
      if (err.name === 'NotAllowedError') {
        errorMessage = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = '카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료하고 다시 시도해주세요.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = '카메라 설정이 지원되지 않습니다. 다른 카메라를 시도해주세요.';
      } else {
        errorMessage = '카메라 접근 실패: ' + err.message;
      }
      
      setCameraError(errorMessage);
      alert(errorMessage);
    }
  }, [updateViewportHeight, cameraReady]);

  const stopCamera = useCallback(() => {
    try {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
    } catch (error) {
      console.warn('Error stopping camera:', error);
    }
    trackRef.current = null;
    imageCaptureRef.current = null;
    setCameraReady(false);
    setCameraError(null);
  }, []);

  // 시작/정리
  useEffect(() => {
    let mounted = true;
    
    const initCamera = async () => {
      if (!mounted) return;
      
      try {
        await startCamera();
      } catch (error) {
        console.error('Camera initialization failed:', error);
        if (mounted) {
          setCameraError('카메라 초기화 실패');
        }
      }
    };
    
    // 약간 지연 후 카메라 시작 (DOM이 완전히 준비된 후)
    const timer = setTimeout(initCamera, 100);
    
    // 초기 진입/리사이즈/오리엔테이션/뷰포트 변경 시 컨테이너 높이 동기화
    updateViewportHeight();
    const onResize = () => updateViewportHeight();
    const onOrient = () => setTimeout(updateViewportHeight, 350);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrient);
    try { window.visualViewport?.addEventListener('resize', onResize); } catch {}
    
    // 페이지 이탈/언로드 시 카메라 정리
    const onVisibility = () => {
      if (document.hidden) {
        if (mounted) {
          stopCamera();
        }
      } else if (!streamRef.current && mounted) {
        // 다시 보이면 필요 시 재시작
        setTimeout(() => {
          if (mounted) {
            initCamera();
          }
        }, 200);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onPageHide = () => {
      if (mounted) {
        stopCamera();
      }
    };
    window.addEventListener('pagehide', onPageHide);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrient);
      try { window.visualViewport?.removeEventListener('resize', onResize); } catch {}
      stopCamera();
    };
  }, []); // startCamera와 stopCamera를 의존성에서 제거하여 무한 루프 방지

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
    try {
      showToast('재초점 시도 중...');
      
      // 기존 스트림 정리
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
      
      // 상태 리셋
      setCameraReady(false);
      setCameraError(null);
      
      // 잠시 대기 후 재시작
      await new Promise(resolve => setTimeout(resolve, 800));
      
      await startCamera();
      showToast('재초점 완료');
    } catch (error) {
      console.error('Refocus failed:', error);
      showToast('재초점 실패. 다시 시도해주세요.');
    }
  };

  // 촬영: ImageCapture → 캔버스 폴백 (원본 그대로 LoadingPage로 전달)
  const takePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    
    // 카메라가 준비되지 않았으면 촬영 불가
    if (!cameraReady) { 
      showToast('카메라가 아직 준비되지 않았습니다. 잠시 기다려주세요.');
      return; 
    }
    
    // 비디오가 준비되었는지 더 엄격하게 확인
    if (video.readyState < 2) { 
      showToast('카메라가 아직 준비되지 않았습니다. 잠시 기다려주세요.');
      return; 
    }

    if (isCapturingRef.current) return;
    isCapturingRef.current = true;

    try {
      showToast('촬영 중...');
      
      // 셔터 전 약간 대기하여 AF가 자리 잡도록 함
      await new Promise((r) => setTimeout(r, 300));

      // 1) ImageCapture가 있으면 우선 사용
      try {
        if (imageCaptureRef.current?.takePhoto) {
          const raw = await imageCaptureRef.current.takePhoto();
          if (raw) {
            // 다른 페이지로 이동하므로 즉시 카메라 정리
            stopCamera();
            navigate('/load', { state: { imageBlob: raw, captureInfo: { source: 'imageCapture' } } });
            return;
          }
        }
      } catch (error) {
        console.warn('ImageCapture failed, falling back to canvas:', error);
      }

      // 2) 폴백: <video> 프레임을 캔버스로 JPEG 캡처
      try {
        const track = trackRef.current;
        const s = track?.getSettings?.() ?? {};
        const w = s.width || video.videoWidth || 1280;
        const h = s.height || video.videoHeight || 720;
        
        // 캔버스 크기 설정
        canvas.width = w; 
        canvas.height = h;
        
        const ctx = canvas.getContext('2d');
        
        // 비디오가 실제로 재생 중인지 확인
        if (video.paused || video.ended) {
          throw new Error('Video is not playing');
        }
        
        ctx.drawImage(video, 0, 0, w, h);
        
        const raw = await new Promise((res, rej) => {
          canvas.toBlob((blob) => {
            if (blob) {
              res(blob);
            } else {
              rej(new Error('Failed to create blob'));
            }
          }, 'image/jpeg', 0.9);
        });
        
        if (raw) {
          stopCamera();
          navigate('/load', { state: { imageBlob: raw, captureInfo: { source: 'canvas', width: w, height: h } } });
        } else {
          throw new Error('Failed to capture image');
        }
      } catch (err) {
        console.error('canvas capture failed', err);
        showToast('이미지 캡처 실패. 다시 시도해주세요.');
      }
    } finally {
      // 라우팅으로 언마운트되더라도 안전, 실패 시 재시도 가능하게 해제
      isCapturingRef.current = false;
    }
  };

  const goBack = () => navigate('/home', { replace: true });

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ height: viewportH ? `${viewportH}px` : undefined }}>
      {/* 카메라 미리보기 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        disablePictureInPicture
        disableRemotePlayback
        className="w-full h-full object-cover touch-manipulation"
        onPointerDown={handleTapFocus}
        style={{
          transform: 'scaleX(1)', // 미러링 방지
          backfaceVisibility: 'hidden', // 성능 최적화
        }}
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

      {/* 카메라 상태 표시 */}
      {!cameraReady && !cameraError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-4 py-2 rounded z-20">
          카메라 준비 중...
        </div>
      )}
      
      {cameraError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600/90 text-white px-4 py-2 rounded z-20 max-w-xs text-center">
          {cameraError}
        </div>
      )}

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
        disabled={!cameraReady || isCapturingRef.current}
        className={`absolute bottom-10 left-1/2 -translate-x-1/2 w-[90px] h-[90px] rounded-full border-[4px] z-10 transition-all duration-200 ${
          cameraReady && !isCapturingRef.current
            ? 'bg-white border-gray-300 hover:bg-gray-100'
            : 'bg-gray-400 border-gray-500 cursor-not-allowed'
        }`}
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


