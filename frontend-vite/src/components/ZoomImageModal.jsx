import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import UIButton from './common/UIButton';

export default function ZoomImageModal({ open, src, onClose }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 16px)` }}
    >
      <div 
        className="w-screen h-screen flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt="최근 문서 미리보기"
          className="max-w-[100vw] max-h-[100vh] w-auto h-auto object-contain rounded-lg shadow-2xl animate-scale-in"
          draggable={false}
        />
      </div>
      
      <UIButton
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
        aria-label="닫기"
      >
        <X size={24} />
      </UIButton>
    </div>
  );
}


