import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UIButton from '../components/common/UIButton';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/recent_docs`, {
          credentials: 'include'
        });
        const data = await res.json();
        const items = (data.items || []).map(it => ({
          docId: it.doc_id || String(it.mtime || ''),
          date: new Date((it.mtime || 0) * 1000).toLocaleDateString('ko-KR').slice(2),
          title: it.title || '문서',
          thumb: `${import.meta.env.VITE_API_URL}/api/image?path=${encodeURIComponent(it.path || '')}`
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

  return (
    <div className="w-full max-w-[480px] min-h-[100dvh] mx-auto flex flex-col items-center justify-start p-5 relative">
      <div className="font-semibold text-[16px] mb-[14px] self-start pl-5">최근 찍은 문서 보기</div>

      <div className="flex flex-col gap-[10px] w-full overflow-y-auto mb-0 px-5 pb-[140px]">
        {docs.map((doc, i) => (
          <div
            key={i}
            className="flex justify-between items-center border border-[rgba(200,200,200,0.3)] rounded-[12px] p-5 bg-[var(--bg-color)] shadow-sm"
            onClick={() => navigate('/summary', { state: { summary: '', docId: doc.docId, fromHome: true } })}
          >
            <div>
              <div className="text-[15px] text-[var(--font-color)] mb-[2px]">{doc.date}</div>
              <div className="text-[20px] font-medium">문서</div>
            </div>
            <div className="w-[50px] h-[50px] ml-2 rounded-[8px] bg-gray-700 overflow-hidden">
              {doc.thumb && (
                <img src={doc.thumb} alt="thumb" className="w-full h-full object-cover" />
              )}
            </div>
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
    </div>
  );
}
