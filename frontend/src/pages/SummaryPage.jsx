// SummaryPage.js

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const serverUrl = process.env.REACT_APP_API_SERVER_URL;
  const summaryText = location.state?.summary || '';
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [chatList, setChatList] = useState([
    { type: 'summary', text: summaryText }
  ]);
  const [isRecording, setIsRecording] = useState(false);

  // ----------- 음성 재생/중지 함수 -----------
  const playVoice = async () => {
    stopVoice();
    if (!summaryText) return;
    try {
      // 실제 서버 호출 부분(비동기)
      // const response = await axios.post(
      //   `${serverUrl}/tts`,
      //   { text: summaryText },
      //   { responseType: 'blob' }
      // );
      // const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      // const audioUrl = URL.createObjectURL(audioBlob);
      // const audio = new Audio(audioUrl);

      // 테스트 용도로만 (서버 없이 동작)
      const audio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
      audioRef.current = audio;
      setIsPlaying(true);
      audio.play()
        .then(() => console.log('[재생 성공]'))
        .catch(err => {
          setIsPlaying(false);
          console.error('[재생 실패]', err);
        });
      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.addEventListener('pause', () => setIsPlaying(false));
    } catch (error) {
      setIsPlaying(false);
      alert('음성 재생에 실패했습니다.');
    }
  };

  const stopVoice = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  // ----------- 마이크 (녹음 토글) -----------
  const handleMicClick = () => {
    if (!isRecording) {
      setIsRecording(true);
      alert("녹음 시작 (실제 구현 필요)");
    } else {
      setIsRecording(false);
      alert("녹음 종료 (실제 구현 필요)");
    }
  };

  // ----------- 전송 버튼 -----------
  const isSendActive = inputValue.trim().length > 0;
  const handleSend = () => {
    if (!isSendActive) return;
    setChatList(prev => [
      ...prev,
      { type: 'question', text: inputValue }
    ]);
    setInputValue('');
  };

  // ----------- 뒤로가기(카메라) 이동 -----------
  const handleBack = () => {
    stopVoice();
    navigate('/camera');
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
            msg.type === 'summary' ? (
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
          {/* 마이크 버튼 */}
          <button
            style={{
              ...styles.micButton,
              background: isRecording ? '#ba2727' : '#f33d2d',
              boxShadow: isRecording ? '0 0 0 2px #d36e6e' : styles.micButton.boxShadow
            }}
            onClick={handleMicClick}
            title="음성 녹음"
          >
            <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
              <circle cx="45" cy="45" r="40" fill="#F44336"/>
              <rect x="34" y="28" width="22" height="30" rx="11" fill="#fff"/>
              <rect x="42" y="60" width="6" height="8" rx="2" fill="#fff"/>
              <rect x="32" y="44" width="26" height="7" rx="3.5" fill="#fff"/>
              
            </svg>
           
          </button>
          {/* 입력창 */}
          <input
            style={styles.input}
            placeholder="질문을 입력하세요"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => isSendActive && e.key === 'Enter' && handleSend()}
          />
          {/* 전송 버튼 */}
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
    width: 360,
    height: 600,
    maxWidth: '100vw',
    margin: '0 auto',
    border: 'none',
    borderRadius: 18,
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden'
  },
  topBar: {
    height: 44,
    width: '100%',
    background: '#111',
    display: 'flex',
    alignItems: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    marginBottom: 0,
    justifyContent: 'flex-start',
    flexShrink: 0,
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
    padding: '18px 10px 18px 10px',
    background: '#fff',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  // summary(요약) 말풍선 - 넓게, 버튼과 하나의 박스!
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
  // 질문 말풍선 - 오른쪽, 파랑
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
    padding: '12px 12px 14px 12px',
    background: '#fff',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    boxSizing: 'border-box',
    flexShrink: 0,
    position: 'relative'
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: '#f33d2d',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    boxShadow: '0 2px 8px 0 rgba(30,30,30,0.08)',
    cursor: 'pointer',
    transition: 'background 0.1s'
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
    background: '#fff'
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