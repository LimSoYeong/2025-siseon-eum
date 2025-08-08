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
  const [inputValue, setInputValue] = useState('');
  const [chatList, setChatList] = useState([
    { type: 'summary', text: summaryText }
  ]);

  // STT
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  // 애니메이션용 state (파동)
  const [pulse, setPulse] = useState(false);

  // 녹음 애니메이션(파동) 타이머 관리
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

  // ----------- "다시 듣기" 기능 -----------
  const playVoice = useCallback(async () => {
    stopVoice();
    if (!summaryText) return;
    try {
      const response = await axios.post(`${apiUrl}/api/tts`, { text: summaryText }, { responseType: "blob" });
      const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.play()
        .then(() => {})
        .catch(() => setIsPlaying(false));

      audio.addEventListener("ended", () => setIsPlaying(false));
      audio.addEventListener("pause", () => setIsPlaying(false));
    } catch (error) {
      setIsPlaying(false);
      alert('TTS 요청 실패');
    }
  }, [apiUrl, summaryText]);

  // 최초 진입시 summary 자동 재생 (StrictMode의 이중 마운트 대비: 1초 쿨다운)
  useEffect(() => {
    const isUserInteracted = window.sessionStorage.getItem("userInteracted");
    if (!summaryText || isUserInteracted !== "true") return;
    const key = "summary_tts_once_at";
    const last = Number(window.sessionStorage.getItem(key) || 0);
    const now = Date.now();
    if (now - last < 1000) return; // 1초 내 재호출 방지
    window.sessionStorage.setItem(key, String(now));
    playVoice();
  }, [summaryText, playVoice]);

  // ----------- 뒤로가기(카메라) 이동 -----------
  const handleBack = () => {
    stopVoice();
    navigate('/camera');
  };

  // ----------- 마이크 (녹음 토글) -----------
  const handleMicClick = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];

        recorder.ondataavailable = (e) => {
          chunks.push(e.data);
        };
        recorder.onstop = async () => {
          if (!Array.isArray(chunks)) return;
          const audioBlob = new Blob(chunks, { type: 'audio/mp3' });
          setAudioChunks([]);

          // 업로드용 form 데이터
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.mp3");

          try {
            const res = await axios.post(`${apiUrl}/api/stt`, formData, {
              headers: { "Content-Type": "multipart/form-data" },
              withCredentials: true,
            });
            // 👇 바로 질문 보내기
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

  // 녹음 중지 핸들러
  const handleStopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
  };

  // ----------- 전송 버튼 -----------
  const isSendActive = inputValue.trim().length > 0;
  const handleSend = async (text) => {
    const finalText = text || inputValue;
    if (!finalText.trim()) return;

    // 질문 추가
    setChatList(prev => [
      ...prev,
      { type: 'question', text: finalText }
    ]);
    setInputValue('');

    try {
      const res = await axios.post(`${apiUrl}/api/ask`, {
        question: finalText
      }, {
        withCredentials: true
      });

      const answer = res.data?.answer || res.data.error || '답변을 가져오지 못했습니다.';

      // 답변 추가
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

  // ----------- 채팅 스크롤 하단 고정 -----------
  const chatEndRef = useRef();
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatList]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* 상단바 */}
        <div style={styles.topBar}>
          <button style={styles.backBtn} onClick={handleBack}>&larr;</button>
          <span style={styles.topTitle}>다시 찍기</span>
        </div>
        {/* 채팅 영역 */}
        <div style={styles.chatArea}>
          {chatList.map((msg, idx) =>
            msg.type === 'summary' || msg.type === 'answer' ? (
              <div key={idx} style={styles.summaryBox}>
                <div style={styles.summaryText}>{msg.text}</div>
                <div style={styles.voiceBtnBox}>
                  {!isPlaying ? (
                    <button
                      style={styles.playBtn}
                      onClick={playVoice}
                    >
                      <span style={{ marginRight: 4, fontSize: 17 }}>▶</span> 다시듣기
                    </button>
                  ) : (
                    <button
                      style={styles.stopBtn}
                      onClick={stopVoice}
                    >
                      <span style={{ marginRight: 4, fontSize: 17 }}>■</span> 음성중지
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                key={idx}
                style={{
                  ...styles.chatBubble,
                  ...(msg.type === 'question'
                    ? styles.questionBubble
                    : styles.answerBubble)
                }}
              >
                {msg.text}
              </div>
            )
          )}
          <div ref={chatEndRef} />
        </div>
        {/* 하단 입력바 */}
        <div style={styles.bottomBar}>
          {/* 마이크 버튼 or 녹음 중 버튼 */}
          {!isRecording ? (
            <button
              style={{
                ...styles.micButton,
                ...(pulse ? styles.micPulse : {}),
              }}
              onClick={handleMicClick}
              title="음성 녹음"
            >
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="22" fill="#F44336" />
                <g>
                  <rect x="17" y="11" width="10" height="18" rx="5" fill="#fff" />
                  <rect x="21" y="31" width="2" height="4" rx="1" fill="#fff" />
                  <rect x="16" y="23" width="12" height="3" rx="1.5" fill="#fff" />
                </g>
                {/* 마이크 아이콘, 필요시 더 예쁘게 */}
              </svg>
            </button>
          ) : (
            <button
              style={styles.stopRecBtn}
              onClick={handleStopRecording}
            >
              <span className="wave-ani" style={styles.waveAni} />
              질문 끝내기
            </button>
          )}
          {/* 입력창 */}
          <input
            style={styles.input}
            placeholder="질문을 입력하세요"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => isSendActive && e.key === 'Enter' && handleSend()}
            disabled={isRecording}
          />
          {/* 전송 버튼 (녹음 중엔 숨김) */}
          {!isRecording && (
            <button
              style={{
                ...styles.sendButton,
                background: isSendActive ? '#111' : '#f1f1f1',
                color: isSendActive ? '#fff' : '#c0c0c0',
                cursor: isSendActive ? 'pointer' : 'not-allowed',
                border: isSendActive ? 'none' : '1.2px solid #ececec'
              }}
              onClick={isSendActive ? handleSend : undefined}
              disabled={!isSendActive}
            >전송</button>
          )}
        </div>
      </div>
      {/* 녹음중 애니메이션을 위한 스타일 */}
      <style>
        {`
          .wave-ani {
            display: inline-block;
            width: 10px; height: 10px;
            border-radius: 50%;
            background: #fff176;
            margin-right: 8px;
            box-shadow: 0 0 0 0 #fff176;
            animation: wavePulse 1s infinite cubic-bezier(0.4, 0, 0.2, 1);
            vertical-align: middle;
          }
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

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  container: {
    width: '100%',
    height: '100dvh',
    maxWidth: '100%',
    margin: 0,
    border: 'none',
    borderRadius: 0,
    background: 'var(--bg-color)',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden'
  },
  topBar: {
    minHeight: 48,
    width: '100%',
    background: '#111',
    display: 'flex',
    alignItems: 'center',
    paddingTop: 'max(env(safe-area-inset-top), 8px)',
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 0,
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 22,
    marginLeft: 2,
    cursor: 'pointer',
    outline: 'none'
  },
  topTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 500,
    marginLeft: 7,
    letterSpacing: -1,
  },
  chatArea: {
    flex: 1,
    width: '100%',
    padding: '12px 10px 12px 10px',
    background: 'var(--bg-color)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  summaryBox: {
    alignSelf: 'flex-start',
    width: '90%',
    background: '#fcfafb',
    borderRadius: 18,
    padding: '16px 16px 11px 16px',
    marginBottom: 2,
    boxShadow: '0 1px 6px 0 rgba(50,50,50,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  summaryText: {
    color: '#222',
    fontSize: 15.5,
    lineHeight: 1.6,
    wordBreak: 'break-word',
    marginBottom: 4,
    whiteSpace: 'pre-line'
  },
  voiceBtnBox: {
    display: 'flex',
    marginTop: 2,
  },
  playBtn: {
    display: 'flex',
    alignItems: 'center',
    background: '#25c03b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 20px',
    fontWeight: 600,
    fontSize: 17,
    cursor: 'pointer',
    boxShadow: '0 1px 6px 0 rgba(30,30,30,0.08)'
  },
  stopBtn: {
    display: 'flex',
    alignItems: 'center',
    background: '#f78427',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 20px',
    fontWeight: 600,
    fontSize: 17,
    cursor: 'pointer',
    boxShadow: '0 1px 6px 0 rgba(30,30,30,0.10)'
  },
  chatBubble: {
    maxWidth: '75%',
    padding: '13px 16px',
    borderRadius: 14,
    fontSize: 15.5,
    lineHeight: 1.55,
    wordBreak: 'break-all',
    marginBottom: 2,
    display: 'flex',
    flexDirection: 'column',
  },
  questionBubble: {
    alignSelf: 'flex-end',
    background: '#e7f1ff',
    color: '#1d3d68',
  },
  answerBubble: {
    alignSelf: 'flex-start',
    background: '#e9ffe7',
    color: '#244e23',
  },
  bottomBar: {
    width: '100%',
    minHeight: 56,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px max(env(safe-area-inset-bottom), 12px) 12px',
    background: 'var(--bg-color)',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    boxSizing: 'border-box',
    flexShrink: 0,
    position: 'relative'
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#f33d2d',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    boxShadow: '0 2px 8px 0 rgba(30,30,30,0.08)',
    cursor: 'pointer',
    transition: 'box-shadow 0.3s'
  },
  micPulse: {
    boxShadow: '0 0 0 8px #ffd83588, 0 2px 8px 0 rgba(30,30,30,0.13)'
  },
  stopRecBtn: {
    flex: 'none',
    width: 220,
    height: 44,
    fontWeight: 700,
    borderRadius: 22,
    border: 'none',
    background: '#ffd835',
    color: '#333',
    fontSize: 17,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px 0 rgba(230,200,50,0.10)',
    cursor: 'pointer',
    marginRight: 7,
    transition: 'background 0.3s'
  },
  waveAni: {
    marginRight: 8
  },
  input: {
    flex: 1,
    height: 38,
    border: '1.5px solid #e0e0e0',
    borderRadius: 16,
    padding: '0 12px',
    fontSize: 15,
    outline: 'none',
    marginRight: 6,
    background: 'var(--bg-color)'
  },
  sendButton: {
    height: 38,
    minWidth: 48,
    fontWeight: 600,
    border: 'none',
    borderRadius: 13,
    fontSize: 15,
    cursor: 'pointer',
    transition: 'background 0.2s, color 0.2s'
  }
};
