import React from 'react';

// CSS 키프레임 기반 주기적 애니메이션 이퀄라이저
export default function RecordingEqualizer({ label = '' }) {
  return (
    <div className="w-full flex flex-col items-center justify-center my-2">
      <div className="equalizer">
        <div className="eq-bar animate-bar-1" />
        <div className="eq-bar animate-bar-2" />
        <div className="eq-bar animate-bar-3" />
        <div className="eq-bar animate-bar-2" />
        <div className="eq-bar animate-bar-1" />
      </div>
      {label ? (
        <div className="mt-2 text-sm text-zinc-700 select-none">{label}</div>
      ) : null}
    </div>
  );
}


