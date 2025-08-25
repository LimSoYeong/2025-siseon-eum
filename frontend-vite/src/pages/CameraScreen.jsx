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
  const detectionIntervalRef = useRef(null);

  const [focusUI, setFocusUI] = useState(null);
  const [vsize, setVsize] = useState({ w: 0, h: 0 });
  const [focusSupported, setFocusSupported] = useState(false);
  const [toast, setToast] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [guidelineSize, setGuidelineSize] = useState({ width: 0.9, height: 0.85 });
  
  const navigate = useNavigate();
  const isCapturingRef = useRef(false);

  // 동적 뷰포트 높이 처리
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

  // 모바일 판정
  const isMobile = useMemo(() => isMobileDevice(), []);

  // 어르신 눈에 뛰는 색상 (밝은 주황색)
  const guidelineColor = '#FF6B35';
  const guidelineBorderColor = '#FF4500';
  
  // 자동감지 상태에 따른 가이드라인 색상
  const getGuidelineColors = () => {
    if (isAutoDetecting) {
      return {
        color: '#FF6B35', // 주황색 (자동감지 켜짐)
        borderColor: '#FF4500'
      };
    } else {
      return {
        color: '#10B981', // 초록색 (자동감지 꺼짐)
        borderColor: '#059669'
      };
    }
  };

  const showToast = useCallback((msg, ms = 2000) => {
    setToast(msg);
    if (ms) setTimeout(() => setToast(''), ms);
  }, []);

  // 가이드라인 크기 계산 (화면 크기에 따라 동적 조정)
  const calculateGuidelineSize = useCallback(() => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // 화면 크기에 따라 가이드라인 크기 조정
    if (screenWidth < 375) {
      // 작은 화면 (iPhone SE 등)
      return { width: 0.95, height: 0.9 };
    } else if (screenWidth < 768) {
      // 중간 화면 (일반 스마트폰)
      return { width: 0.92, height: 0.87 };
    } else {
      // 큰 화면 (태블릿 등)
      return { width: 0.88, height: 0.83 };
    }
  }, []);

  // 문서 자동 감지 함수
  const detectDocument = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return false;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // 캔버스 크기를 비디오 크기에 맞춤
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 가이드라인 영역만 캡처
      const guidelineWidth = video.videoWidth * guidelineSize.width;
      const guidelineHeight = video.videoHeight * guidelineSize.height;
      const startX = (video.videoWidth - guidelineWidth) / 2;
      const startY = (video.videoHeight - guidelineHeight) / 2;

      // 가이드라인 영역만 그리기
      ctx.drawImage(
        video,
        startX, startY, guidelineWidth, guidelineHeight,
        0, 0, canvas.width, canvas.height
      );

      // 이미지 데이터 분석 (간단한 엣지 감지)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let edgeCount = 0;
      let totalPixels = data.length / 4;

      // 간단한 엣지 감지 알고리즘
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // 밝기 계산
        const brightness = (r + g + b) / 3;
        
        // 엣지 감지 (밝기 변화가 큰 픽셀)
        if (brightness < 50 || brightness > 200) {
          edgeCount++;
        }
      }

      // 엣지 비율 계산
      const edgeRatio = edgeCount / totalPixels;
      
      // 문서 감지 임계값 (조정 가능)
      const threshold = 0.15;
      
      return edgeRatio > threshold;
    } catch (error) {
      console.warn('Document detection failed:', error);
      return false;
    }
  }, [cameraReady, guidelineSize]);

  // 자동 감지 시작
  const startAutoDetection = useCallback(() => {
    if (detectionIntervalRef.current) return;
    
    setIsAutoDetecting(true);
    setDetectionCount(0);
    
    detectionIntervalRef.current = setInterval(async () => {
      if (!cameraReady || isCapturingRef.current) return;
      
      const isDocumentDetected = await detectDocument();
      
      if (isDocumentDetected) {
        setDetectionCount(prev => {
          const newCount = prev + 1;
          // 3초 연속 감지되면 자동 촬영
          if (newCount >= 3) {
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
            setIsAutoDetecting(false);
            // takePhoto 함수를 직접 호출하지 않고 이벤트를 발생시킴
            setTimeout(() => {
              if (videoRef.current && canvasRef.current) {
                takePhoto();
              }
            }, 100);
            return 0;
          }
          return newCount;
        });
      } else {
        setDetectionCount(0);
      }
    }, 1000); // 1초마다 감지
  }, [cameraReady, detectDocument]);

  // 자동 감지 중지
  const stopAutoDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsAutoDetecting(false);
    setDetectionCount(0);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setCameraReady(false);
      
      // 기존 스트림 정리
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 카메라 권한 확인
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

      // 비디오 연결
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        video.autoplay = true;
        
        const onLoaded = () => {
          console.log('Video loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
          setVsize({ w: video.videoWidth, h: video.videoHeight });
          setCameraReady(true);
          updateViewportHeight();
          
          // 가이드라인 크기 업데이트
          setGuidelineSize(calculateGuidelineSize());
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
        
        try {
          await video.play();
          console.log('Video play successful');
        } catch (playError) {
          console.warn('Video play failed, retrying...', playError);
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
  }, [updateViewportHeight, calculateGuidelineSize]);

  const stopCamera = useCallback(() => {
    stopAutoDetection();
    
    try {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => track.stop());
        streamRef.current = null;
      }
    } catch (error) {
      console.warn('Error stopping camera:', error);
    }
    trackRef.current = null;
    imageCaptureRef.current = null;
    setCameraReady(false);
    setCameraError(null);
  }, [stopAutoDetection]);

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
    
    const timer = setTimeout(initCamera, 100);
    
    updateViewportHeight();
    const onResize = () => {
      updateViewportHeight();
      setGuidelineSize(calculateGuidelineSize());
    };
    const onOrient = () => setTimeout(onResize, 350);
    
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrient);
    try { window.visualViewport?.addEventListener('resize', onResize); } catch {}
    
    const onVisibility = () => {
      if (document.hidden) {
        if (mounted) {
          stopCamera();
        }
      } else if (!streamRef.current && mounted) {
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
  }, []);

  // 카메라 준비 완료 시 자동 감지 시작
  useEffect(() => {
    if (cameraReady && !isAutoDetecting) {
      // 약간의 지연 후 자동 감지 시작
      const timer = setTimeout(() => {
        startAutoDetection();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [cameraReady, isAutoDetecting, startAutoDetection]);

  // 탭 포커스 (모바일에서만)
  const handleTapFocus = async (e) => {
    if (!isMobile) return;

    const video = videoRef.current;
    if (!video || !focusSupported) return;

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

    try {
      if (imageCaptureRef.current?.setOptions) {
        await imageCaptureRef.current.setOptions({
          pointsOfInterest: [{ x: normX, y: normY }],
          focusMode: 'single-shot',
        });
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

  // 재초점
  const refocusTrick = async () => {
    try {
      showToast('재초점 시도 중...');
      
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      setCameraReady(false);
      setCameraError(null);
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      await startCamera();
      showToast('재초점 완료');
    } catch (error) {
      console.error('Refocus failed:', error);
      showToast('재초점 실패. 다시 시도해주세요.');
    }
  };

  // 촬영
  const takePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    
    if (!cameraReady) { 
      showToast('카메라가 아직 준비되지 않았습니다. 잠시 기다려주세요.');
      return; 
    }
    
    if (video.readyState < 2) { 
      showToast('카메라가 아직 준비되지 않았습니다. 잠시 기다려주세요.');
      return; 
    }

    if (isCapturingRef.current) return;
    isCapturingRef.current = true;

    try {
      showToast('촬영 중...');
      
      await new Promise((r) => setTimeout(r, 300));

      // ImageCapture 우선 사용
      try {
        if (imageCaptureRef.current?.takePhoto) {
          const raw = await imageCaptureRef.current.takePhoto();
          if (raw) {
            stopCamera();
            navigate('/load', { state: { imageBlob: raw, captureInfo: { source: 'imageCapture' } } });
            return;
          }
        }
      } catch (error) {
        console.warn('ImageCapture failed, falling back to canvas:', error);
      }

      // 캔버스 폴백
      try {
        const track = trackRef.current;
        const s = track?.getSettings?.() ?? {};
        const w = s.width || video.videoWidth || 1280;
        const h = s.height || video.videoHeight || 720;
        
        canvas.width = w; 
        canvas.height = h;
        
        const ctx = canvas.getContext('2d');
        
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
      isCapturingRef.current = false;
    }
  };

  const goBack = () => navigate('/home', { replace: true });

  // 가이드라인 스타일 계산
  const guidelineColors = getGuidelineColors();
  const guidelineStyle = {
    position: 'absolute',
    left: `${(1 - guidelineSize.width) * 50}%`,
    top: `${(1 - guidelineSize.height) * 50}%`,
    width: `${guidelineSize.width * 100}%`,
    height: `${guidelineSize.height * 100}%`,
    border: `3px solid ${guidelineColors.color}`,
    borderRadius: '12px',
    boxShadow: `0 0 0 2px ${guidelineColors.borderColor}, 0 0 20px ${isAutoDetecting ? 'rgba(255, 107, 53, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
    pointerEvents: 'none',
    zIndex: 5,
  };

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
          transform: 'scaleX(1)',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* 문서 촬영 가이드라인 */}
      <div style={guidelineStyle}>
        {/* 가이드라인 내부 안내 텍스트 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white bg-black/60 px-4 py-2 rounded-lg">
            <div className="text-sm font-medium">문서를 이 영역에 맞춰주세요</div>
            <div className="text-xs mt-1">자동으로 촬영됩니다</div>
          </div>
        </div>
      </div>

      {/* 자동 감지 상태 표시 */}
      {isAutoDetecting && detectionCount > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600/90 text-white px-4 py-2 rounded-lg z-20">
          <div className="text-sm font-medium">문서 감지 중...</div>
          <div className="text-xs mt-1">{detectionCount}/3</div>
        </div>
      )}

      {/* 탭 포커스 링 */}
      {isMobile && focusSupported && focusUI && (
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

      {/* 뒤로가기 버튼 */}
      <UIButton
        onClick={goBack}
        className="absolute top-5 left-5 px-4 py-2 text-white text-base rounded-md z-10 bg-black/40 hover:bg-black/60 transition-colors"
      >
        ← 뒤로가기
      </UIButton>

      {/* 수동 촬영 버튼 */}
      <UIButton
        aria-label="수동 촬영"
        onClick={takePhoto}
        disabled={!cameraReady || isCapturingRef.current}
        className={`absolute bottom-10 left-1/2 -translate-x-1/2 w-[90px] h-[90px] rounded-full border-[4px] z-10 transition-all duration-200 ${
          cameraReady && !isCapturingRef.current
            ? 'bg-white border-gray-300 hover:bg-gray-100 hover:scale-105'
            : 'bg-gray-400 border-gray-500 cursor-not-allowed'
        }`}
      />

      {/* 재초점 버튼 */}
      <UIButton
        onClick={refocusTrick}
        className="absolute top-5 right-5 px-3 py-2 text-white text-xs rounded-md z-10 bg-black/40 hover:bg-black/60 transition-colors"
      >
        재초점
      </UIButton>

      {/* 자동 감지 토글 버튼 */}
      <UIButton
        onClick={isAutoDetecting ? stopAutoDetection : startAutoDetection}
        className={`absolute bottom-10 right-5 px-3 py-2 text-white text-xs rounded-md z-10 transition-colors ${
          isAutoDetecting 
            ? 'bg-red-600/80 hover:bg-red-600' 
            : 'bg-green-600/80 hover:bg-green-600'
        }`}
      >
        {isAutoDetecting ? '자동감지 끄기' : '자동감지 켜기'}
      </UIButton>
    </div>
  );
}


