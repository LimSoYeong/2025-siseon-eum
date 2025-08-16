import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UIButton from '../components/common/UIButton';
import { API_BASE } from '../config/appConfig';
import ZoomImageModal from '../components/ZoomImageModal';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [zoomModal, setZoomModal] = useState({ open: false, src: '' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const hintShownRef = useRef(false);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/recent_docs`, {
          credentials: 'include'
        });
        const data = await res.json();
        const items = (data.items || []).map(it => ({
          docId: it.doc_id || String(it.mtime || ''),
          date: new Date((it.mtime || 0) * 1000).toLocaleDateString('ko-KR').slice(2),
          title: '문서',
          thumb: `${API_BASE}/api/image?path=${encodeURIComponent(it.path || '')}`
        }));
        setDocs(items);
      } catch (e) {
        setDocs([]);
      }
    };
    fetchDocs();
  }, []);

  const handleStartCamera = () => {
    navigate('/camera');
  };

  const [toast, setToast] = useState('');
  const showToast = useCallback((msg, ms = 1800) => {
    setToast(msg);
    if (ms) setTimeout(() => setToast(''), ms);
  }, []);

  const handleDeleteDoc = async (doc) => {
    const ok = window.confirm('해당 문서를 삭제하시겠어요?');
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE}/api/delete_doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ doc_id: doc.docId, path: doc.thumb?.includes('/api/image?path=') ? decodeURIComponent(doc.thumb.split('=')[1] || '') : undefined })
      });
      const data = await res.json();
      if (!res.ok || !data.removed) throw new Error(data.error || 'delete failed');
      setDocs(prev => prev.filter(d => d.docId !== doc.docId));
      showToast('삭제되었습니다');
    } catch (e) {
      showToast('문서 삭제에 실패했습니다');
    }
  };

  const openZoomModal = (e, src) => {
    e.stopPropagation();
    setZoomModal({ open: true, src });
  };

  const closeZoomModal = () => setZoomModal({ open: false, src: '' });

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
    if (!hintShownRef.current) {
      setShowHint(true);
      hintShownRef.current = true;
    }
    document.body.style.overflow = 'hidden';
  };

  const handleCloseViewer = () => {
    setSelectedImage(null);
    setShowHint(false);
    document.body.style.overflow = '';
  };

  return (
    <div className="w-full max-w-[480px] min-h-[100dvh] mx-auto flex flex-col items-center justify-start p-5 relative">
      <div className="font-semibold text-[20px] mb-[14px] self-start pl-5">최근 찍은 문서 보기</div>

      <div className="flex flex-col gap-[10px] w-full overflow-y-auto mb-0 px-5 pb-[140px]">
        {docs.map((doc, i) => (
          <div
            key={i}
            className="relative flex items-center gap-6 p-5 bg-white border border-gray-200 rounded-[15px] shadow-[0_6px_18px_rgba(0,0,0,0.12)] cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
            onClick={() => navigate('/summary', { state: { summary: '', docId: doc.docId, fromHome: true } })}
          >
            <button
              type="button"
              className="w-[70px] h-[70px] rounded-[5px] bg-gray-700 overflow-hidden flex-shrink-0 focus-visible:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                handleImageClick(doc.thumb);
              }}
              aria-label="썸네일 확대"
            >
              {doc.thumb && (
                <img src={doc.thumb} alt="thumb" className="w-full h-full object-cover pointer-events-none" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] text-gray-400 mb-2">{doc.date}</div>
              <div className="text-[25px] font-black leading-[0.95] text-black truncate">문서</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc); }}
              className="absolute top-6 right-7 text-[15px] text-gray-700 transition-all duration-200 hover:text-black hover:bg-gray-100 hover:shadow px-2 py-1 rounded focus-visible:outline-none"
              aria-label="문서 삭제"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <div className="fixed left-0 right-0 bottom-0 flex justify-center items-center py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-white">
        <UIButton
          className="flex items-center gap-1 w-[calc(100%-40px)] h-[55px] text-[20px] font-medium border border-black rounded-[8px] bg-white text-black cursor-pointer justify-center shadow-sm"
          onClick={handleStartCamera}
        >
          <span role="img" aria-label="camera" className="text-[25px] mr-[5px]">📷</span>
          문서 촬영
        </UIButton>
      </div>

      <ZoomImageModal open={zoomModal.open} src={zoomModal.src} onClose={closeZoomModal} />

      {selectedImage && (
        <FullscreenImageViewer 
          imageUrl={selectedImage} 
          onClose={handleCloseViewer}
          showHint={showHint}
          setShowHint={setShowHint}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-md shadow z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// FullscreenImageViewer 컴포넌트
const FullscreenImageViewer = ({ imageUrl, onClose, showHint, setShowHint }) => {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // 키보드 핸들러
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 터치 거리 계산
  const getTouchDistance = (touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 핀치 줌 핸들러
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches));
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - translate.x, y: e.touches[0].clientY - translate.y });
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      if (lastTouchDistance > 0) {
        const newScale = Math.max(1, Math.min(4, scale * (distance / lastTouchDistance)));
        setScale(newScale);
      }
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      
      // 이미지 경계 내로 제한
      const maxX = (scale - 1) * window.innerWidth / 2;
      const maxY = (scale - 1) * window.innerHeight / 2;
      
      setTranslate({
        x: Math.max(-maxX, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(maxY, newY))
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDistance(0);
  };

  // 더블탭 핸들러
  const handleDoubleTap = () => {
    if (scale === 1) {
      setScale(2);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  };

  // 힌트 숨김
  const hideHint = () => {
    setShowHint(false);
  };

  // 컴포넌트 언마운트 시 스크롤 복원
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 w-full h-full bg-black/90 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 닫기 버튼 */}
      <button
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
        onClick={onClose}
        aria-label="닫기"
      >
        ✕
      </button>

      {/* 힌트 배너 */}
      {showHint && (
        <div 
          className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm z-10 transition-opacity duration-300"
          onClick={(e) => {
            e.stopPropagation();
            hideHint();
          }}
        >
          두 손가락으로 확대 가능합니다
        </div>
      )}

             {/* 이미지 */}
       <img
         ref={imageRef}
         src={imageUrl}
         alt="최근 찍은 문서"
         className="max-w-full max-h-full object-contain"
         style={{
           objectFit: 'contain',
           width: '100%',
           height: '100%',
           transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
           transition: isDragging ? 'none' : 'transform 0.2s ease-out'
         }}
         onClick={(e) => {
           e.stopPropagation();
           if (scale === 1) {
             onClose();
           }
         }}
         onDoubleClick={handleDoubleTap}
       />
    </div>
  );
};
