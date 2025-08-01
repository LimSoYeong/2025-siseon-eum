// SummaryPage.js

import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const serverUrl = process.env.REACT_APP_API_SERVER_URL;
  const summaryText = location.state?.summary || '';
  const audioRef = useRef(null);
  const chatAreaRef = useRef(null);

  const [history, setHistory] = useState([{ type: "summary", text:summaryText }]); // 챗 히스토리
  const [isPlaying, setIsPlaying] = useState(false); // 듣기/중지 토글
  const [recording, setRecording] = useState(false); // 음성 질문 중
  const [loading, setLoading] = useState(false);     // 질문 처리중

  const stopVoice = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  // --- "다시 듣기" 기능 ---
  const playVoice = useCallback(async () => {
    stopVoice();
    if (!summaryText) return;
    
    try {
      const response = await axios.post(`${serverUrl}/api/tts`, { text: summaryText }, { responseType: "blob" });
      console.log('[✅ TTS 응답]', response);
      const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl); 
      audioRef.current = audio;
      setIsPlaying(true);
      audio.play()
        .then(() => console.log("[🎧 재생 성공]"))
        .catch(err => {
          setIsPlaying(false);
          console.error("[❌ 재생 실패]", err);
        });

      audio.addEventListener("ended", () => setIsPlaying(false));
      audio.addEventListener("pause", () => setIsPlaying(false));
    } catch (error) {
      setIsPlaying(false);
      console.error('TTS 요청 실패:', error);
      alert("음성 재생에 실패했습니다.");
    }
  }, [serverUrl, summaryText]);



  // --- 음성 질문 (녹음+업로드) ---
  const mediaRecorderRef = useRef();
  const audioChunksRef = useRef([]);
  const startRecording = async () => {
    setRecording(true);
    setLoading(false);
    if (!navigator.mediaDevices) {
      alert("음성녹음을 지원하지 않는 브라우저입니다.");
      setRecording(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new window.MediaRecorder(stream);
    audioChunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" }); // mp3만 지원시 수정 필요
      sendVoiceToServer(audioBlob);
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  // 음성 파일 서버로 전송(QA)
  const sendVoiceToServer = async (audioBlob) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "question.mp3"); // mp3 지원이면 .mp3로 바꿔서 전송
      const response = await axios.post(
        `${serverUrl}/api/stt`, formData, { headers: { "Content-Type": "multipart/form-data" } }
      );
      setHistory((prev) => [
        ...prev,
        { type: "question", text: response.data.user_text },
        { type: "answer", text: response.data.bot_text, audio: response.data.bot_audio_url }
      ]);
    } catch (e) {
      setHistory((prev) => [
        ...prev,
        { type: "error", text: "서버와의 통신에 실패했습니다." }
      ]);
    }
    setLoading(false);
  };

  // 챗 히스토리 맨 아래로 자동 스크롤
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [history, loading]);

  // 최초 진입시 summary 자동 재생
  useEffect(() => {
    const isUserInteracted = window.sessionStorage.getItem("userInteracted");
    if (summaryText && isUserInteracted === "true") {
      playVoice();
    }
  }, [serverUrl, summaryText, playVoice]);

  const handleBack = () => {
    stopVoice();
    navigate('/camera'); // 다시 찍기로 카메라 화면 이동
  };

  // 하단 버튼 UI 분기
  const renderBottomBar = () => {
    if (recording) {
      return (
        <button
          style={{
            ...styles.voiceButton,
            background: "#27ae60" // 초록
          }}
          onClick={stopRecording}
        >
          <span role="img" aria-label="stop" style={styles.micIcon}>⏹️</span>
          질문 끝내기
        </button>
      );
    } else {
      return (
        <>
          <button
            style={{
              ...styles.voiceButton,
              background: isPlaying ? "#bbb" : "#2980b9"
            }}
            onClick={isPlaying ? stopVoice : playVoice}
            disabled={isPlaying}
          >
            <span role="img" aria-label="sound" style={styles.micIcon}>🔊</span>
            다시 듣기
          </button>
          <button
            style={{
              ...styles.voiceButton,
              background: "#e74c3c",
              marginLeft: 8
            }}
            onClick={startRecording}
          >
            <span role="img" aria-label="mic" style={styles.micIcon}>🎤</span>
            음성 질문
          </button>
        </>
      );
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* 상단바 */}
        <div style={styles.topBar}>
          <button style={styles.backBtn} onClick={handleBack}>&larr;</button>
          <span style={styles.topTitle}>다시 찍기</span>
        </div>
        {/* 챗 히스토리 */}
        <div style={styles.chatArea} ref={chatAreaRef}>
          {history.map((item, idx) => (
            <div key={idx} style={{
              ...styles.bubble,
              ...(item.type === "question" ? styles.userBubble : item.type === "answer" ? styles.botBubble : {})
            }}>
              {item.type === "summary" && <>{item.text}</>}
              {item.type === "question" && <>🙋‍♂️ {item.text}</>}
              {item.type === "answer" &&
                <>
                  🤖 {item.text}
                  {item.audio &&
                    <audio src={item.audio} controls style={{ marginLeft: 8, height: 28 }} />
                  }
                </>
              }
              {item.type === "error" && <span style={{ color: "red" }}>{item.text}</span>}
            </div>
          ))}
          {loading && (
            <div style={{ ...styles.bubble, ...styles.botBubble }}>답변 생성 중...</div>
          )}
        </div>
        {/* 하단 버튼 */}
        <div style={styles.bottomBar}>
          {renderBottomBar()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: 320,
    minHeight: '80vh',
    margin: '40px auto',
    border: '4px solid #eee',
    borderRadius: 18,
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxSizing: 'border-box',
    padding: 0,
    position: 'relative',
  },
  topBar: {
    height: 44,
    width: '100%',
    background: '#111',
    display: 'flex',
    alignItems: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    marginBottom: 8,
    justifyContent: 'flex-start'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 22,
    marginLeft: 12,
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
    minHeight: 240,
    maxHeight: 380,
    overflowY: 'auto',
    padding: '8px 10px',
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 7
  },
  bubble: {
    borderRadius: 10,
    padding: '9px 13px',
    marginBottom: 2,
    maxWidth: '85%',
    wordBreak: "keep-all",
    background: "#f3f6fa",
    color: "#1e293b",
    fontSize: 15.5
  },
  userBubble: {
    alignSelf: "flex-end",
    background: "#e3edfb",
    color: "#003b8c"
  },
  botBubble: {
    alignSelf: "flex-start",
    background: "#e6f7e6",
    color: "#195e19"
  },
  bottomBar: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: "center",
    padding: '14px 0 16px 0',
    background: '#fff',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderTop: '1.5px solid #f3f3f3'
  },
  voiceButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: 240,
    height: 46,
    color: '#fff',
    fontWeight: 600,
    fontSize: 17,
    borderRadius: 24,
    border: 'none',
    boxShadow: '0 2px 10px 0 rgba(30,30,30,0.08)',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.15s'
  },
  micIcon: {
    fontSize: 21,
    marginRight: 4,
  }
};