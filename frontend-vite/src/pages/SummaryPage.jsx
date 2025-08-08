import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mic, MicOff } from 'lucide-react';

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL;
  const summaryText = location.state?.summary || '';
  const docId = location.state?.docId;
  const fromHome = location.state?.fromHome;
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [chatList, setChatList] = useState([
    { type: 'summary', text: summaryText }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let interval;
    if (isRecording) {
      setPulse(true);
      interval = setInterval(() => setPulse(p => !p), 550);
    } else {
      setPulse(false);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const stopVoice = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false); // 음성 재생 상태 업데이트
  };

  const playVoice = useCallback(async () => {
    stopVoice();
    if (!summaryText) return;
    try {
      const response = await axios.post(`${apiUrl}/api/tts`, { text: summaryText }, { responseType: "blob" });
      const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlaying(true); // 음성 재생 중 표시
      audio.play().catch(() => setIsPlaying(false));
      audio.addEventListener("ended", () => setIsPlaying(false));
      audio.addEventListener("pause", () => setIsPlaying(false));
    } catch {
      setIsPlaying(false);
      alert('TTS 요청 실패');
    }
  }, [apiUrl, summaryText]);

  useEffect(() => {
    const isUserInteracted = window.sessionStorage.getItem("userInteracted");
    if (!summaryText || isUserInteracted !== "true") return;
    const key = "summary_tts_once_at";
    const last = Number(window.sessionStorage.getItem(key) || 0);
    const now = Date.now();
    if (now - last < 1000) return;
    window.sessionStorage.setItem(key, String(now));
    playVoice();
  }, [summaryText, playVoice]);

  const handleBack = () => {
    stopVoice();
    if (fromHome) navigate('/home', { replace: true });
    else navigate('/camera', { replace: true });
  };

  const handleMicClick = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          const audioBlob = new Blob(chunks, { type: 'audio/mp3' });
          setAudioChunks([]);
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.mp3");
          try {
            const res = await axios.post(`${apiUrl}/api/stt`, formData, {
              headers: { "Content-Type": "multipart/form-data" },
              withCredentials: true,
            });
            const sttResult = res.data;
            if (sttResult?.trim()) handleSend(sttResult);
          } catch {
            alert("STT 요청 실패");
          }
        };
        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
        setAudioChunks(chunks);
      } catch {
        alert("마이크 권한이 필요합니다.");
      }
    }
  };

  const handleStopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
  };

  const isSendActive = inputValue.trim().length > 0;
  const handleSend = async (text) => {
    const finalText = text || inputValue;
    if (!finalText.trim()) return;
    setChatList(prev => [...prev, { type: 'question', text: finalText }]);
    setInputValue('');
    try {
      const res = await axios.post(`${apiUrl}/api/ask`, {
        question: finalText
      }, { withCredentials: true });
      const answer = res.data?.answer || res.data.error || '답변을 가져오지 못했습니다.';
      setChatList(prev => [...prev, { type: 'answer', text: answer }]);
    } catch {
      setChatList(prev => [...prev, { type: 'answer', text: '서버 오류로 답변을 가져오지 못했습니다.' }]);
    }
  };

  const chatEndRef = useRef();
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatList]);

  useEffect(() => {
    const load = async () => {
      if (!docId) return;
      try {
        const res = await fetch(`${apiUrl}/api/conversation?doc_id=${encodeURIComponent(docId)}`, { credentials: 'include' });
        const data = await res.json();
        const msgs = (data.messages || []).map(m => ({ type: m.role === 'assistant' ? 'answer' : 'question', text: m.text }));
        if (msgs.length) setChatList(msgs);
      } catch {}
    };
    load();
  }, [apiUrl, docId]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex flex-col h-[100dvh] overflow-hidden">
        <div className="flex items-center p-3 bg-black text-white text-base font-medium">
          <button className="mr-2 text-xl" onClick={handleBack}>&larr;</button>
          <span>다시 찍기</span>
        </div>
        <div className="flex flex-col gap-4 p-3 flex-1 overflow-y-auto">
          {chatList.map((msg, idx) => (
            msg.type === 'summary' || msg.type === 'answer' ? (
              <div key={idx} className="bg-[#fcfafb] p-4 rounded-xl shadow text-[15.5px] leading-relaxed whitespace-pre-line">
                {msg.text}
                <div className="mt-2">
                  {!isPlaying ? (
                    <button className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded shadow" onClick={playVoice}>
                      <span className="text-lg">▶</span> 다시듣기
                    </button>
                  ) : (
                    <button className="flex items-center gap-1 bg-orange-500 text-white px-4 py-2 rounded shadow" onClick={stopVoice}>
                      <span className="text-lg">■</span> 음성중지
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div key={idx} className={`max-w-[75%] px-4 py-3 rounded-[14px] text-[15.5px] leading-[1.55] break-words ${msg.type === 'question' ? 'self-end bg-blue-100 text-blue-900' : 'self-start bg-green-100 text-green-900'}`}>
                {msg.text}
              </div>
            )
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          {!isRecording ? (
            <button
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow ${pulse ? 'shadow-[0_0_0_8px_#ffd83588]' : ''} bg-red-600`}
              onClick={handleMicClick}
              title="음성 녹음"
            >
              <Mic color="white" size={28} />
            </button>
          ) : (
            <button
              className="flex-1 h-11 flex items-center justify-center bg-yellow-300 rounded-full font-bold text-[17px] text-zinc-800 shadow"
              onClick={handleStopRecording}
            >
              <span className="wave-ani mr-2" /> 질문 끝내기
            </button>
          )}
          <input
            className="flex-1 h-10 rounded-[16px] px-3 text-[15px] border border-gray-300 bg-white"
            placeholder="질문을 입력하세요"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => isSendActive && e.key === 'Enter' && handleSend()}
            disabled={isRecording}
          />
          {!isRecording && (
            <button
              className={`h-10 min-w-[48px] rounded-[13px] font-semibold text-[15px] ${isSendActive ? 'bg-black text-white cursor-pointer' : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'}`}
              onClick={isSendActive ? handleSend : undefined}
              disabled={!isSendActive}
            >전송</button>
          )}
        </div>
      </div>
      <style>{`
        .wave-ani {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #fff176;
          margin-right: 8px;
          box-shadow: 0 0 0 0 #fff176;
          animation: wavePulse 1s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes wavePulse {
          0% { box-shadow: 0 0 0 0 #fff176; opacity: 1; }
          70% { box-shadow: 0 0 0 10px rgba(255, 241, 118, 0.5); opacity: 0.7; }
          100% { box-shadow: 0 0 0 0 #fff176; opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
