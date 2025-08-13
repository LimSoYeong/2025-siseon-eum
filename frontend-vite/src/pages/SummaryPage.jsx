// // src/pages/SummaryPage.jsx
// import React, { useCallback, useEffect, useRef, useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import axios from 'axios';
// import { Mic } from 'lucide-react';
// import UIButton from '../components/common/UIButton';

// export default function SummaryPage() {
//   const location = useLocation();
//   const navigate = useNavigate();
//   const apiUrl = import.meta.env.VITE_API_URL;
//   const summaryText = location.state?.summary || '';
//   const docId = location.state?.docId;
//   const fromHome = location.state?.fromHome;

//   const audioRef = useRef(null);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [inputValue, setInputValue] = useState('');
//   const [chatList, setChatList] = useState([{ type: 'summary', text: summaryText }]);
//   const [isRecording, setIsRecording] = useState(false);
//   const [mediaRecorder, setMediaRecorder] = useState(null);
//   const [audioChunks, setAudioChunks] = useState([]);
//   const [pulse, setPulse] = useState(false);
//   const [playingId, setPlayingId] = useState(null);
//   const chatEndRef = useRef();

//   useEffect(() => {
//     let interval;
//     if (isRecording) {
//       setPulse(true);
//       interval = setInterval(() => setPulse((p) => !p), 550);
//     } else {
//       setPulse(false);
//     }
//     return () => clearInterval(interval);
//   }, [isRecording]);

//   const stopVoice = () => {
//     if (audioRef.current) {
//       audioRef.current.pause();
//       audioRef.current.currentTime = 0;
//       audioRef.current = null;
//     }
//     setIsPlaying(false);
//     setPlayingId(null);
//   };

//   const playVoice = useCallback(
//     async (text, id) => {
//       stopVoice();
//       if (!text) return;
//       try {
//         const res = await axios.post(`${apiUrl}/api/tts`, { text }, { responseType: 'blob' });
//         const audioBlob = new Blob([res.data], { type: 'audio/mpeg' });
//         const audioUrl = URL.createObjectURL(audioBlob);
//         const audio = new Audio(audioUrl);
//         audioRef.current = audio;

//         setIsPlaying(true);
//         setPlayingId(id);

//         audio.play().catch(() => {
//           setIsPlaying(false);
//           setPlayingId(null);
//         });
//         audio.addEventListener('ended', () => {
//           setIsPlaying(false);
//           setPlayingId(null);
//           URL.revokeObjectURL(audioUrl);
//         });
//         audio.addEventListener('pause', () => {
//           setIsPlaying(false);
//           setPlayingId(null);
//         });
//       } catch {
//         setIsPlaying(false);
//         setPlayingId(null);
//         alert('TTS 요청 실패');
//       }
//     },
//     [apiUrl]
//   );

//   useEffect(() => {
//     const isUserInteracted = window.sessionStorage.getItem('userInteracted');
//     if (!summaryText || isUserInteracted !== 'true') return;
//     const key = 'summary_tts_once_at';
//     const last = Number(window.sessionStorage.getItem(key) || 0);
//     const now = Date.now();
//     if (now - last < 1000) return;
//     window.sessionStorage.setItem(key, String(now));
//     playVoice(summaryText, 0);
//   }, [summaryText, playVoice]);

//   const handleBack = () => {
//     stopVoice();
//     navigate(fromHome ? '/home' : '/camera', { replace: true });
//   };

//   const handleMicClick = async () => {
//     if (isRecording) return;
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       const recorder = new MediaRecorder(stream);
//       const chunks = [];

//       recorder.ondataavailable = (e) => chunks.push(e.data);
//       recorder.onstop = async () => {
//         const audioBlob = new Blob(chunks, { type: 'audio/mp3' });
//         setAudioChunks([]);
//         const formData = new FormData();
//         formData.append('file', audioBlob, 'recording.mp3');
//         try {
//           const res = await axios.post(`${apiUrl}/api/stt`, formData, {
//             headers: { 'Content-Type': 'multipart/form-data' },
//             withCredentials: true,
//           });
//           const sttResult = res.data;
//           if (sttResult?.trim()) handleSend(sttResult);
//         } catch {
//           alert('STT 요청 실패');
//         }
//       };

//       recorder.start();
//       setMediaRecorder(recorder);
//       setIsRecording(true);
//       setAudioChunks(chunks);
//     } catch {
//       alert('마이크 권한이 필요합니다.');
//     }
//   };

//   const handleStopRecording = () => {
//     mediaRecorder?.stop();
//     setIsRecording(false);
//   };

//   const isSendActive = inputValue.trim().length > 0;
//   const handleSend = async (text) => {
//     const finalText = text || inputValue;
//     if (!finalText.trim()) return;
//     setChatList((prev) => [...prev, { type: 'question', text: finalText }]);
//     setInputValue('');
//     try {
//       const res = await axios.post(`${apiUrl}/api/ask`, { question: finalText }, { withCredentials: true });
//       const answer = res.data?.answer || res.data.error || '답변을 가져오지 못했습니다.';
//       setChatList((prev) => [...prev, { type: 'answer', text: answer }]);
//     } catch {
//       setChatList((prev) => [...prev, { type: 'answer', text: '서버 오류로 답변을 가져오지 못했습니다.' }]);
//     }
//   };

//   useEffect(() => {
//     if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
//   }, [chatList]);

//   useEffect(() => {
//     const load = async () => {
//       if (!docId) return;
//       try {
//         const res = await fetch(`${apiUrl}/api/conversation?doc_id=${encodeURIComponent(docId)}`, {
//           credentials: 'include',
//         });
//         const data = await res.json();
//         const msgs = (data.messages || []).map((m) => ({
//           type: m.role === 'assistant' ? 'answer' : 'question',
//           text: m.text,
//         }));
//         if (msgs.length) setChatList(msgs);
//       } catch {}
//     };
//     load();
//   }, [apiUrl, docId]);

//   return (
//     <div className="min-h-screen w-full flex flex-col bg-white">
//       <div className="flex flex-col h-[100dvh] w-full overflow-hidden">
//         {/* 상단 바 (가로 꽉 채움) */}
//         <div className="w-full flex items-center p-3 bg-black text-white text-base font-medium">
//           <UIButton className="mr-2 text-xl" onClick={handleBack}>
//             &larr;
//           </UIButton>
//           <span>다시 찍기</span>
//         </div>

//         {/* 메시지 영역 (가로 꽉 채움) */}
//         <div className="w-full flex flex-col gap-4 p-3 flex-1 overflow-y-auto">
//           {chatList.map((msg, idx) =>
//             msg.type === 'summary' || msg.type === 'answer' ? (
//               <div
//                 key={idx}
//                 className="bg-[#fcfafb] p-4 rounded-xl shadow text-[15.5px] leading-relaxed whitespace-pre-line"
//               >
//                 {msg.text}

//                 {!isRecording && (
//                   <div className="mt-2">
//                     {isPlaying && playingId === idx ? (
//                       <UIButton
//                         className="flex items-center gap-1 bg-orange-500 text-white px-4 py-2 rounded shadow"
//                         onClick={stopVoice}
//                       >
//                         <span className="text-lg">■</span> 음성중지
//                       </UIButton>
//                     ) : (
//                       <UIButton
//                         className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded shadow"
//                         onClick={() => playVoice(msg.text, idx)}
//                       >
//                         <span className="text-lg">▶</span> 다시듣기
//                       </UIButton>
//                     )}
//                   </div>
//                 )}
//               </div>
//             ) : (
//               <div
//                 key={idx}
//                 className={`max-w-[75%] px-4 py-3 rounded-[14px] text-[15.5px] leading-[1.55] break-words ${
//                   msg.type === 'question' ? 'self-end bg-blue-100 text-blue-900' : 'self-start bg-green-100 text-green-900'
//                 }`}
//               >
//                 {msg.text}
//               </div>
//             )
//           )}
//           <div ref={chatEndRef} />
//         </div>

//         {/* 하단 바: 상태별로 별도 래퍼(sticky)로 고정 */}
//         {!isRecording ? (
//           <div className="w-full flex items-center gap-2 px-3 py-2 sticky bottom-0 bg-white">
//             <UIButton
//               className={`w-14 h-14 rounded-full flex items-center justify-center shadow ${
//                 pulse ? 'shadow-[0_0_0_8px_#ffd83588]' : ''
//               } bg-red-600`}
//               onClick={handleMicClick}
//               title="음성 녹음"
//             >
//               <Mic color="white" size={28} />
//             </UIButton>

//             <input
//               className="flex-1 h-10 rounded-[16px] px-3 text-[15px] border border-gray-300 bg-white"
//               placeholder="질문을 입력하세요"
//               value={inputValue}
//               onChange={(e) => setInputValue(e.target.value)}
//               onKeyDown={(e) => isSendActive && e.key === 'Enter' && handleSend()}
//             />
//             <UIButton
//               className={`h-10 min-w-[48px] rounded-[13px] font-semibold text-[15px] ${
//                 inputValue.trim().length
//                   ? 'bg-black text-white cursor-pointer'
//                   : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
//               }`}
//               onClick={inputValue.trim().length ? () => handleSend() : undefined}
//               disabled={!inputValue.trim().length}
//             >
//               전송
//             </UIButton>
//           </div>
//         ) : (
//           <div className="w-full px-3 py-3 sticky bottom-0 bg-white">
//             <UIButton className="w-full h-12 rounded-full font-bold text-[17px] text-zinc-800 bg-yellow-300 shadow"
//               onClick={handleStopRecording}
//             >
//               <span className="relative mr-2 inline-flex h-2.5 w-2.5 items-center justify-center">
//                 <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75 animate-ping"></span>
//                 <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
//               </span>
//               질문 끝내기
//             </UIButton>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


// 모바일에서 가능하게 수정한 SummaryPage.jsx 

// src/pages/SummaryPage.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mic } from 'lucide-react';
import UIButton from '../components/common/UIButton';

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL;
  const summaryText = location.state?.summary || '';
  const docId = location.state?.docId;
  const fromHome = location.state?.fromHome;

  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const streamRef = useRef(null);
  const chatEndRef = useRef();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [chatList, setChatList] = useState([{ type: 'summary', text: summaryText }]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [pulse, setPulse] = useState(false);

  const ROUTES = {
    TTS: '/api/tts',
    STT: '/api/stt',
    ASK: '/api/ask',
    CONV: '/api/conversation',
  };
  const u = (path) => new URL(path, apiUrl).toString();

  // 녹음 중 깜빡임
  useEffect(() => {
    let interval;
    if (isRecording) {
      setPulse(true);
      interval = setInterval(() => setPulse((p) => !p), 550);
    } else {
      setPulse(false);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // 자원 정리
  const stopVoice = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load?.();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    } catch {}
    setIsPlaying(false);
    setPlayingId(null);
  };

  const stopStream = () => {
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopVoice();
      stopStream();
    };
  }, []);

  // 자동재생 정책 대응: 사용자 상호작용 마킹
  const markInteracted = () => {
    try {
      window.sessionStorage.setItem('userInteracted', 'true');
    } catch {}
  };

  // TTS 재생
  const playVoice = useCallback(
    async (text, id) => {
      stopVoice();
      if (!text) return;

      try {
        const res = await axios.post(
          u(ROUTES.TTS),
          { text },
          { responseType: 'blob', withCredentials: true }
        );

        const audioBlob = new Blob([res.data], { type: res.data.type || 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        setIsPlaying(true);
        setPlayingId(id);

        const onEndOrPause = () => {
          setIsPlaying(false);
          setPlayingId(null);
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
        };

        audio.addEventListener('ended', onEndOrPause);
        audio.addEventListener('pause', onEndOrPause);

        audio.play().catch(() => {
          onEndOrPause();
        });
      } catch {
        setIsPlaying(false);
        setPlayingId(null);
        alert('TTS 요청 실패');
      }
    },
    [apiUrl]
  );

  // 요약 자동 한번 듣기 (사용자 상호작용 후)
  useEffect(() => {
    const isUserInteracted = window.sessionStorage.getItem('userInteracted');
    if (!summaryText || isUserInteracted !== 'true') return;
    const key = 'summary_tts_once_at';
    const last = Number(window.sessionStorage.getItem(key) || 0);
    const now = Date.now();
    if (now - last < 1000) return;
    window.sessionStorage.setItem(key, String(now));
    playVoice(summaryText, 0);
  }, [summaryText, playVoice]);

  const handleBack = () => {
    stopVoice();
    stopStream();
    navigate(fromHome ? '/home' : '/camera', { replace: true });
  };

  // 녹음 시작
  const handleMicClick = async () => {
    if (isRecording) return;
    markInteracted();

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('이 브라우저는 음성 녹음을 지원하지 않습니다.');
      return;
    }
    if (typeof window.MediaRecorder === 'undefined') {
      alert('MediaRecorder를 지원하지 않는 환경입니다.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 브라우저가 지원하는 mimeType 선택
      const preferred = [
        'audio/webm;codecs=opus',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/webm',
      ];
      const pick = preferred.find((t) => window.MediaRecorder.isTypeSupported?.(t)) || '';

      const recorder = pick ? new MediaRecorder(stream, { mimeType: pick }) : new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        try {
          const blobType = recorder.mimeType || (chunks[0] && chunks[0].type) || 'application/octet-stream';
          const audioBlob = new Blob(chunks, { type: blobType });
          const ext = blobType.includes('mp4') || blobType.includes('m4a')
            ? 'm4a'
            : blobType.includes('webm')
            ? 'webm'
            : 'bin';

          setAudioChunks([]); // UI 용도로 유지

          const formData = new FormData();
          formData.append('file', audioBlob, `recording.${ext}`);

          await axios.post(u(ROUTES.STT), formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            withCredentials: true,
          }).then((res) => {
            const sttResult = res.data;
            if (typeof sttResult === 'string' && sttResult.trim()) {
              handleSend(sttResult);
            } else if (sttResult?.text?.trim()) {
              handleSend(sttResult.text.trim());
            } else {
              alert('음성 인식 결과가 비어있습니다.');
            }
          }).catch(() => {
            alert('STT 요청 실패');
          });
        } finally {
          stopStream(); // 마이크 해제
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioChunks(chunks);
    } catch {
      alert('마이크 권한이 필요합니다.');
    }
  };

  const handleStopRecording = () => {
    try {
      mediaRecorder?.stop();
    } catch {}
    setIsRecording(false);
  };

  const isSendActive = inputValue.trim().length > 0;

  // 질문 전송
  const handleSend = async (text) => {
    markInteracted();

    const finalText = (text ?? inputValue).trim();
    if (!finalText) return;

    setChatList((prev) => [...prev, { type: 'question', text: finalText }]);
    setInputValue('');

    try {
      const res = await axios.post(
        u(ROUTES.ASK),
        { question: finalText },
        { withCredentials: true }
      );
      const answer = res.data?.answer || res.data?.error || '답변을 가져오지 못했습니다.';
      setChatList((prev) => [...prev, { type: 'answer', text: answer }]);
    } catch {
      setChatList((prev) => [...prev, { type: 'answer', text: '서버 오류로 답변을 가져오지 못했습니다.' }]);
    }
  };

  // 맨 아래 스크롤
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatList]);

  // 기존 대화 불러오기
  useEffect(() => {
    const load = async () => {
      if (!docId) return;
      try {
        const url = new URL(ROUTES.CONV, apiUrl);
        url.searchParams.set('doc_id', docId);
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const msgs = (data.messages || []).map((m) => ({
          type: m.role === 'assistant' ? 'answer' : 'question',
          text: m.text,
        }));
        if (msgs.length) setChatList(msgs);
      } catch {
        // noop
      }
    };
    load();
  }, [apiUrl, docId]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      <div className="flex flex-col h-[100dvh] w-full overflow-hidden">
        {/* 상단 바 */}
        <div className="w-full flex items-center p-3 bg-black text-white text-base font-medium">
          <UIButton className="mr-2 text-xl" onClick={handleBack}>&larr;</UIButton>
          <span>다시 찍기</span>
        </div>

        {/* 메시지 영역 */}
        <div className="w-full flex flex-col gap-4 p-3 flex-1 overflow-y-auto">
          {chatList.map((msg, idx) =>
            msg.type === 'summary' || msg.type === 'answer' ? (
              <div
                key={idx}
                className="bg-[#fcfafb] p-4 rounded-xl shadow text-[15.5px] leading-relaxed whitespace-pre-line"
              >
                {msg.text}

                {!isRecording && (
                  <div className="mt-2">
                    {isPlaying && playingId === idx ? (
                      <UIButton
                        className="flex items-center gap-1 bg-orange-500 text-white px-4 py-2 rounded shadow"
                        onClick={stopVoice}
                      >
                        <span className="text-lg">■</span> 음성중지
                      </UIButton>
                    ) : (
                      <UIButton
                        className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded shadow"
                        onClick={() => playVoice(msg.text, idx)}
                      >
                        <span className="text-lg">▶</span> 다시듣기
                      </UIButton>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div
                key={idx}
                className={`max-w-[75%] px-4 py-3 rounded-[14px] text-[15.5px] leading-[1.55] break-words ${
                  msg.type === 'question'
                    ? 'self-end bg-blue-100 text-blue-900'
                    : 'self-start bg-green-100 text-green-900'
                }`}
              >
                {msg.text}
              </div>
            )
          )}
          <div ref={chatEndRef} />
        </div>

        {/* 하단 바 */}
        {!isRecording ? (
          <div className="w-full flex items-center gap-2 px-3 py-2 sticky bottom-0 bg-white">
            <UIButton
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow ${
                pulse ? 'shadow-[0_0_0_8px_#ffd83588]' : ''
              } bg-red-600`}
              onClick={handleMicClick}
              title="음성 녹음"
            >
              <Mic color="white" size={28} />
            </UIButton>

            <input
              className="flex-1 h-10 rounded-[16px] px-3 text-[15px] border border-gray-300 bg-white"
              placeholder="질문을 입력하세요"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => isSendActive && e.key === 'Enter' && handleSend()}
            />
            <UIButton
              className={`h-10 min-w-[48px] rounded-[13px] font-semibold text-[15px] ${
                inputValue.trim().length
                  ? 'bg-black text-white cursor-pointer'
                  : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              }`}
              onClick={inputValue.trim().length ? () => handleSend() : undefined}
              disabled={!inputValue.trim().length}
            >
              전송
            </UIButton>
          </div>
        ) : (
          <div className="w-full px-3 py-3 sticky bottom-0 bg-white">
            <UIButton
              className="w-full h-12 rounded-full font-bold text-[17px] text-zinc-800 bg-yellow-300 shadow"
              onClick={handleStopRecording}
            >
              <span className="relative mr-2 inline-flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75 animate-ping"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
              </span>
              질문 끝내기
            </UIButton>
          </div>
        )}
      </div>
    </div>
  );
}
