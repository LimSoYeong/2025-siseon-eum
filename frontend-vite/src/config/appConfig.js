// 전역 환경/디바이스/타이밍/미디어 관련 설정을 한 곳에서 관리합니다.

export const isMobileDevice = () => {
  try {
    const ua = navigator.userAgent || '';
    const mobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
    const touch = (navigator.maxTouchPoints || 0) > 0;
    const small = Math.min(window.innerWidth, window.innerHeight) < 820;
    const isWindows = /Windows NT/i.test(ua);
    return mobileUA || (touch && small && !isWindows);
  } catch {
    return false;
  }
};

// 카메라 기본 해상도(이상값). 실제 적용은 트랙 capabilities에 맞춰 클램핑됩니다.
export const CAMERA_CONFIG = Object.freeze({
  MOBILE: { width: 1920, height: 1080, frameRate: 30 },
  DESKTOP: { width: 2560, height: 1440, frameRate: 30 },
});

// 업로드 이미지 표준화 파라미터
export const IMAGE_UPLOAD_CONFIG = Object.freeze({
  MAX_W: 1920,
  MAX_H: 1920,
  JPEG_Q: 0.8,
});

// 화면 전환/애니메이션 등 타이밍
export const TIMING = Object.freeze({
  splashDelayMs: 1500,
  pageAnimMs: 300,
});

// API 베이스 URL: .env > 전역 오버라이드 > 현재 오리진 순으로 결정
function normalizeBase(base) {
  if (!base) return '';
  return String(base).replace(/\/$/, '');
}

export const API_BASE = normalizeBase(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
    (typeof window !== 'undefined' && (window.__API_BASE__ || window.location?.origin)) ||
    ''
);


