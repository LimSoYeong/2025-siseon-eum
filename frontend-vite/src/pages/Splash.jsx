import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UIButton from '../components/common/UIButton';
import { TIMING } from '../config/appConfig';

export default function Splash() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => navigate('/home'), TIMING.pageAnimMs);
    }, TIMING.splashDelayMs);
    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className={`w-full max-w-[400px] min-h-[80vh] mx-auto flex flex-col items-center justify-center bg-[var(--bg-color)] p-[38px_0] ${leaving ? 'animate-fade-out-up' : 'animate-fade-slide'}`}>
      <h1 className="text-[32px] font-bold mt-[18px] mb-[30px] tracking-tight text-center" style={{ fontFamily: 'NanumMyeongjo, serif' }}>
        시선이음
      </h1>
      <div className="text-[15px] text-[var(--font-color)] text-center mb-4">
        보는 것에서, 이해로. 시선을 잇다.
      </div>
    </div>
  );
}
