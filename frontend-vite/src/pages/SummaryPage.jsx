//---------tailwind css 적용----------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL;
  const summaryText = location.state?.summary || '';
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
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
    setIsPlaying(false);
  };

  const playVoice = useCallback(async () => {
    stopVoice();
    if (!summaryText) return;

    try {
      setTtsLoading(true);
      const response = await axios.post(
        `${apiUrl}/api/tts`,
        { text: summaryText },
        { responseType: "blob" }
      );
      const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.play().catch(() => setIsPlaying(false));
      audio.addEventListener("ended", () => setIsPlaying(false));
      audio.addEventListener("pause", () => setIsPlaying(false));
    } catch (error) {
      setIsPlaying(false);
      alert('TTS 요청 실패');
    } finally {
      setTtsLoading(false);
    }
  }, [apiUrl, summaryText]);

  useEffect(() => {
    const isUserInteracted = window.sessionStorage.getItem("userInteracted");
    if (summaryText && isUserInteracted === "true") {
      playVoice();
    }
  }, [apiUrl, summaryText, playVoice]);

  const handleBack = () => {
    stopVoice();
    navigate('/camera');
  };

  const handleMicClick = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new window.MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (e) => { chunks.push(e.data); };
        recorder.onstop = async () => {
          if (!Array.isArray(chunks)) return;
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
            if (sttResult && sttResult.trim().length > 0) {
              handleSend(sttResult);
            }
          } catch (err) {
            alert("STT 요청 실패");
          }
        };
        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
        setAudioChunks(chunks);
      } catch (err) {
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
    setChatList(prev => [
      ...prev,
      { type: 'question', text: finalText }
    ]);
    setInputValue('');
    try {
      const res = await axios.post(`${apiUrl}/api/ask`, {
        question: finalText
      }, { withCredentials: true });
      const answer = res.data?.answer || res.data.error || '답변을 가져오지 못했습니다.';
      setChatList(prev => [
        ...prev,
        { type: 'answer', text: answer }
      ]);
    } catch (err) {
      setChatList(prev => [
        ...prev,
        { type: 'answer', text: '서버 오류로 답변을 가져오지 못했습니다.' }
      ]);
    }
  };

  const chatEndRef = useRef();
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatList]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-[360px] h-[600px] max-w-full mx-auto rounded-[18px] bg-white flex flex-col relative overflow-hidden">
        {/* 상단바 */}
        <div className="w-full h-11 bg-white flex items-center rounded-t-[14px] mb-0 justify-start shrink-0 box-border pl-0">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center bg-[#111] text-white border-none rounded-[8px] text-[17px] font-normal px-[16px] pr-[22px] h-10 min-w-[135px] box-border cursor-pointer ml-[15px] hover:bg-[#222] hover:text-[#ffd835] transition-colors"
          >
            <span className="text-[22px] mr-[9px] ml-[-2px] font-normal inline-block">&lt;</span>
            다시 찍기
          </button>
        </div>
        {/* 채팅 영역 */}
        <div className="flex-1 w-full py-[18px] px-[10px] bg-white overflow-y-auto flex flex-col gap-4">
          {chatList.map((msg, idx) =>
            msg.type === 'summary' || msg.type === 'answer' ? (
              <div key={idx} className="self-start w-[90%] bg-[#fcfafb] rounded-[18px] px-4 pt-4 pb-3 mb-1 shadow-[0_1px_6px_0_rgba(50,50,50,0.04)] flex flex-col gap-2.5">
                <div className="text-[#222] text-[15.5px] leading-[1.6] whitespace-pre-line mb-1 break-words">{msg.text}</div>
                <div className="flex mt-[2px]">
                  {!isPlaying ? (
                    <button
                      className="flex items-center bg-[#25c03b] text-white border-none rounded-[8px] py-2 px-5 font-semibold text-[17px] shadow-[0_1px_6px_0_rgba(30,30,30,0.08)]"
                      onClick={playVoice}
                      disabled={ttsLoading}
                    >
                      <span className="mr-1 text-[17px]">▶</span> 다시듣기
                    </button>
                  ) : (
                    <button
                      className="flex items-center bg-[#f78427] text-white border-none rounded-[8px] py-2 px-5 font-semibold text-[17px] shadow-[0_1px_6px_0_rgba(30,30,30,0.10)]"
                      onClick={stopVoice}
                    >
                      <span className="mr-1 text-[17px]">■</span> 음성중지
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                key={idx}
                className={[
                  "max-w-[75%] py-[13px] px-4 rounded-[14px] text-[15.5px] leading-[1.55] break-all mb-1 flex flex-col",
                  msg.type === 'question'
                    ? "self-end bg-[#e7f1ff] text-[#1d3d68]"
                    : "self-start bg-[#e9ffe7] text-[#244e23]"
                ].join(" ")}
              >
                {msg.text}
              </div>
            )
          )}
          <div ref={chatEndRef} />
        </div>
        {/* 하단 입력바 */}
        <div className="w-full min-h-[56px] flex items-center gap-2 px-3 pt-3 pb-3.5 bg-white rounded-b-[14px] box-border shrink-0 relative flex-nowrap">
          {/* 마이크 버튼 or 녹음 중 버튼 */}
          {!isRecording ? (
            <button
              className={[
                "w-14 h-14 rounded-full bg-[#f33d2d] border-none flex items-center justify-center mr-2 shadow-[0_2px_8px_0_rgba(30,30,30,0.08)] cursor-pointer transition-shadow",
                pulse ? "shadow-[0_0_0_8px_#ffd83588,0_2px_8px_0_rgba(30,30,30,0.13)]" : ""
              ].join(" ")}
              onClick={handleMicClick}
              title="음성 녹음"
              disabled={ttsLoading}
            >
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="22" fill="#F44336" />
                <g>
                  <rect x="17" y="11" width="10" height="18" rx="5" fill="#fff" />
                  <rect x="21" y="31" width="2" height="4" rx="1" fill="#fff" />
                  <rect x="16" y="23" width="12" height="3" rx="1.5" fill="#fff" />
                </g>
              </svg>
            </button>
          ) : (
            <button
              className="flex-none w-[220px] h-11 font-bold rounded-[22px] border-none bg-[#ffd835] text-[#333] text-[17px] flex items-center justify-center shadow-[0_2px_8px_0_rgba(230,200,50,0.10)] cursor-pointer mr-2 transition-colors"
              onClick={handleStopRecording}
            >
              <span
                className="inline-block w-[10px] h-[10px] rounded-full bg-[#fff176] mr-2 align-middle"
                style={{
                  boxShadow: "0 0 0 0 #fff176",
                  animation: "wavePulse 1s infinite cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />
              질문 끝내기
            </button>
          )}
          {/* 입력창 */}
          <input
            className="flex-1 min-w-0 h-[38px] border border-[#e0e0e0] rounded-[16px] px-3 text-[15px] outline-none mr-1 bg-white"
            placeholder="질문을 입력하세요"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => isSendActive && e.key === 'Enter' && handleSend()}
            disabled={isRecording || ttsLoading}
          />
          {/* 전송 버튼 (녹음 중엔 숨김) */}
          {!isRecording && (
            <button
              className={[
                "h-[38px] min-w-[60px] flex-shrink-0 font-semibold rounded-[13px] text-[15px] flex items-center justify-center leading-none px-5 font-sans transition-colors",
                isSendActive
                  ? "bg-[#111] text-white cursor-pointer border-none"
                  : "bg-[#f1f1f1] text-[#c0c0c0] cursor-not-allowed border border-[#ececec]"
              ].join(" ")}
              onClick={isSendActive && !ttsLoading ? handleSend : undefined}
              disabled={!isSendActive || ttsLoading}
            >
              {ttsLoading ? '음성 생성 중...' : '전송'}
            </button>
          )}
        </div>
      </div>
      {/* 녹음중 애니메이션 키프레임 (inline style 적용용) */}
      <style>
        {`
          @keyframes wavePulse {
            0% { box-shadow: 0 0 0 0 #fff176; opacity: 1;}
            70% { box-shadow: 0 0 0 10px rgba(255, 241, 118, 0.5); opacity: 0.7;}
            100% { box-shadow: 0 0 0 0 #fff176; opacity: 0.2;}
          }
        `}
      </style>
    </div>
  );
}

