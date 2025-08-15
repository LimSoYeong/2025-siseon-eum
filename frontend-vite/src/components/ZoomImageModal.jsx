import React from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function ZoomImageModal({ open, src, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white/90 hover:text-white text-[18px] px-3 py-1 rounded bg-white/10"
        aria-label="닫기"
      >
        닫기
      </button>
      <div className="w-[min(100%,_640px)] h-[min(90dvh,_900px)] max-w-full max-h-[90dvh]" onClick={(e) => e.stopPropagation()}>
        <TransformWrapper
          initialScale={1}
          minScale={0.6}
          maxScale={6}
          doubleClick={{ mode: 'zoomIn' }}
          wheel={{ step: 0.2 }}
          pinch={{ disabled: false }}
          panning={{ velocityDisabled: true }}
        >
          <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full">
            <img
              src={src}
              className="w-full h-full object-contain select-none"
              draggable={false}
              alt=""
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}


