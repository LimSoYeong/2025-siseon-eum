import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import UIButton from '../components/common/UIButton';
const API_BASE = import.meta.env.VITE_API_URL;

export default function HomeScreen() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);

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
            <div className="w-[70px] h-[70px] rounded-[5px] bg-gray-700 overflow-hidden flex-shrink-0">
              {doc.thumb && (
                <img src={doc.thumb} alt="thumb" className="w-full h-full object-cover" />
              )}
            </div>
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

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-md shadow z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
