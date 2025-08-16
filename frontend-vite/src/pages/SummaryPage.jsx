// 모바일에서 가능하게 수정한 SummaryPage.jsx 

// src/pages/SummaryPage.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mic } from 'lucide-react';
import UIButton from '../components/common/UIButton';
import RecordingEqualizer from '../components/RecordingEqualizer';
import FeedbackModal from '../components/FeedbackModal';
import { API_BASE } from '../config/appConfig';

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const apiUrl = API_BASE;
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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const pendingAnswerIndexRef = useRef(null);
  const pendingQuestionIndexRef = useRef(null);

  // 파형 시각화용 ref들
  const waveformCanvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const animationIdRef = useRef(null);
  const dataArrayRef = useRef(null);
  const bufferLengthRef = useRef(0);
  const phaseRef = useRef(0);
  const recordStartAtRef = useRef(0);
  const [recordMs, setRecordMs] = useState(0);

  // 녹음 상태에 따라 파형 시각화 시작/정지
  useEffect(() => {
    if (isRecording && streamRef.current) {
      // 다음 페인트 이후 캔버스가 보장되도록 요청
      const id = requestAnimationFrame(() => startVisualization(streamRef.current));
      return () => cancelAnimationFrame(id);
    } else {
      stopVisualization();
    }
  }, [isRecording]);

  // 녹음 타이머
  useEffect(() => {
    if (!isRecording) return;
    recordStartAtRef.current = Date.now();
    setRecordMs(0);
    const id = setInterval(() => {
      setRecordMs(Date.now() - recordStartAtRef.current);
    }, 200);
    return () => clearInterval(id);
  }, [isRecording]);

  const formatRecordTime = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const mm = Math.floor(totalSec / 60);
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const ROUTES = {
    TTS: '/api/tts',
    STT: '/api/stt',
    ASK: '/api/ask',
    CONV: '/api/conversation',
    RECENT: '/api/recent_docs',
    IMAGE: '/api/image',
    START: '/api/start_session',
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

  const stopVisualization = () => {
    try {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch {}
        sourceNodeRef.current = null;
      }
      if (analyserRef.current) {
        try { analyserRef.current.disconnect?.(); } catch {}
        analyserRef.current = null;
      }
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        audioContextRef.current = null;
        try { ctx.close(); } catch {}
      }
    } catch {}
  };

  const startVisualization = (stream) => {
    try {
      if (animationIdRef.current) return; // already running
      const Canvas = waveformCanvasRef.current;
      if (!Canvas) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;
      try { ctx.resume?.(); } catch {}
      const source = sourceNodeRef.current || ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      source.connect(analyser);

      bufferLengthRef.current = analyser.frequencyBinCount; // equalizer bars
      dataArrayRef.current = new Uint8Array(bufferLengthRef.current);
      phaseRef.current = 0;

      const draw = () => {
        const canvas = waveformCanvasRef.current;
        const analyserNode = analyserRef.current;
        if (!canvas || !analyserNode) return;

        const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
        const cssWidth = canvas.clientWidth || 300;
        const cssHeight = canvas.clientHeight || 80;
        if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
          canvas.width = cssWidth * dpr;
          canvas.height = cssHeight * dpr;
        }

        const g = canvas.getContext('2d');
        if (!g) return;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);

        const width = cssWidth;
        const height = cssHeight;
        const mid = height / 2;

        // 배경
        g.fillStyle = '#0a0a0a';
        g.fillRect(0, 0, width, height);

        // 주파수 데이터로 바 그리기 (왼쪽 정렬, 오른쪽은 타이머/버튼 영역 비움)
        const dataArray = dataArrayRef.current;
        analyserNode.getByteFrequencyData(dataArray);

        const rightPadding = 140; // 타이머+버튼 영역
        const drawableWidth = Math.max(0, width - rightPadding);
        const barCount = Math.min(36, Math.max(14, Math.floor(drawableWidth / 10)));
        const step = Math.floor(dataArray.length / barCount);
        const barGap = 4;
        const barWidth = Math.max(3, Math.floor((drawableWidth / barCount) - barGap));
        g.strokeStyle = '#ef4444'; // red-500
        g.lineCap = 'round';

        for (let i = 0; i < barCount; i += 1) {
          const v = dataArray[i * step] || 0; // 0..255
          const normalized = v / 255; // 0..1
          const h = Math.max(6, normalized * height * 0.8);
          const x = i * (barWidth + barGap) + barWidth / 2 + 16; // 좌측 패딩
          g.lineWidth = barWidth;
          g.beginPath();
          g.moveTo(x, mid - h / 2);
          g.lineTo(x, mid + h / 2);
          g.stroke();
        }

        // 점선은 제거하여 두 번째 이미지 느낌 강화

        animationIdRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch {}
  };

  useEffect(() => {
    return () => {
      stopVoice();
      stopStream();
      stopVisualization();
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
    // 이미 재생 중인 답변 TTS가 있다면 즉시 중지
    stopVoice();
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

          // 1) STT 전에 대기 말풍선 추가
          pendingQuestionIndexRef.current = null;
          setChatList((prev) => {
            const idx = prev.length;
            pendingQuestionIndexRef.current = idx;
            return [...prev, { type: 'question-pending', text: '' }];
          });

          await axios.post(u(ROUTES.STT), formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            withCredentials: true,
          }).then((res) => {
            const sttResult = res.data;
            let recognized = '';
            if (typeof sttResult === 'string') recognized = sttResult.trim();
            else if (sttResult?.text) recognized = String(sttResult.text).trim();

            if (recognized) {
              // 2) 대기 말풍선을 실제 질문으로 교체 후 답변 요청
              setChatList((prev) => {
                const arr = [...prev];
                const idx = pendingQuestionIndexRef.current;
                if (idx != null && arr[idx]) arr[idx] = { type: 'question', text: recognized };
                else arr.push({ type: 'question', text: recognized });
                return arr;
              });
              // 비동기로 답변 요청 + 대기 말풍선 처리
              requestAnswerWithPending(recognized);
            } else {
              // STT 실패 메시지 표시
              setChatList((prev) => {
                const arr = [...prev];
                const idx = pendingQuestionIndexRef.current;
                const fallback = { type: 'question', text: '음성 인식 결과가 비어있습니다.' };
                if (idx != null && arr[idx]) arr[idx] = fallback;
                else arr.push(fallback);
                return arr;
              });
            }
          }).catch(() => {
            setChatList((prev) => {
              const arr = [...prev];
              const idx = pendingQuestionIndexRef.current;
              const fallback = { type: 'question', text: 'STT 요청 실패' };
              if (idx != null && arr[idx]) arr[idx] = fallback;
              else arr.push(fallback);
              return arr;
            });
          });
        } finally {
          stopStream(); // 마이크 해제
          stopVisualization(); // 파형 중지
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioChunks(chunks);
      // 사용자 제스처 시점에서 바로 시각화 시작 (iOS 정책 대응)
      startVisualization(stream);
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
  const requestAnswerWithPending = async (finalText) => {
    // 1) 답변 대기 말풍선 추가
    pendingAnswerIndexRef.current = null;
    setChatList((prev) => {
      const idx = prev.length;
      pendingAnswerIndexRef.current = idx;
      return [...prev, { type: 'answer-pending', text: '' }];
    });

    // 2) 답변 요청 후 교체
    try {
      const res = await axios.post(
        u(ROUTES.ASK),
        { question: finalText, doc_id: docId },
        { withCredentials: true }
      );
      // 세션 미존재 케이스 자동 복구 시도
      if (res.data && res.data.error && String(res.data.error).includes('/start_session')) {
        const recovered = await recoverSessionFromRecentDoc();
        if (recovered) {
          const res2 = await axios.post(
            u(ROUTES.ASK),
            { question: finalText, doc_id: docId },
            { withCredentials: true }
          );
          const answer2 = res2.data?.answer || res2.data?.error || '답변을 가져오지 못했습니다.';
          setChatList((prev) => {
            const arr = [...prev];
            const idx = pendingAnswerIndexRef.current;
            if (idx != null && arr[idx]) arr[idx] = { type: 'answer', text: answer2 };
            else arr.push({ type: 'answer', text: answer2 });
            return arr;
          });
          return;
        }
      }

      const answer = res.data?.answer || res.data?.error || '답변을 가져오지 못했습니다.';
      setChatList((prev) => {
        const arr = [...prev];
        const idx = pendingAnswerIndexRef.current;
        if (idx != null && arr[idx]) arr[idx] = { type: 'answer', text: answer };
        else arr.push({ type: 'answer', text: answer });
        return arr;
      });
    } catch {
      setChatList((prev) => {
        const arr = [...prev];
        const idx = pendingAnswerIndexRef.current;
        const fallback = { type: 'answer', text: '서버 오류로 답변을 가져오지 못했습니다.' };
        if (idx != null && arr[idx]) arr[idx] = fallback;
        else arr.push(fallback);
        return arr;
      });
    }
  };

  // 최근 문서 목록에서 해당 docId의 원본 이미지를 찾아 세션을 복원
  async function recoverSessionFromRecentDoc() {
    try {
      const res = await fetch(u(ROUTES.RECENT), { credentials: 'include' });
      if (!res.ok) return false;
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const found = items.find((it) => String(it.doc_id) === String(docId));
      const path = found?.path || null;
      if (!path) return false;
      const imgRes = await fetch(`${u(ROUTES.IMAGE)}?path=${encodeURIComponent(path)}`, { credentials: 'include' });
      if (!imgRes.ok) return false;
      const blob = await imgRes.blob();
      const fd = new FormData();
      fd.append('image', new File([blob], 'restore.jpg', { type: blob.type || 'image/jpeg' }));
      const start = await fetch(u(ROUTES.START), { method: 'POST', body: fd, credentials: 'include' });
      return start.ok;
    } catch {
      return false;
    }
  }

  const handleSend = async (text) => {
    markInteracted();

    const finalText = (text ?? inputValue).trim();
    if (!finalText) return;

    setChatList((prev) => [...prev, { type: 'question', text: finalText }]);
    setInputValue('');

    requestAnswerWithPending(finalText);
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

  // 피드백 모달 자동 표시
  useEffect(() => {
    if (summaryText && docId) {
      const feedbackGiven = localStorage.getItem(`feedback_given:${docId}`);
      if (!feedbackGiven) {
        // 약간의 지연 후 모달 표시 (사용자가 페이지를 볼 수 있도록)
        const timer = setTimeout(() => {
          setShowFeedbackModal(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [summaryText, docId]);

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
            msg.type === 'summary' || msg.type === 'answer' || msg.type === 'answer-pending' ? (
              <div
                key={idx}
                className="bg-[#fcfafb] p-4 rounded-xl shadow text-[15.5px] leading-relaxed whitespace-pre-line"
              >
                {msg.type === 'answer-pending' ? (
                  <span className="text-zinc-500">
                    <span className="typing-dots">
                      <span></span><span></span><span></span>
                    </span>
                  </span>
                ) : (
                  msg.text
                )}

                {!isRecording && msg.type !== 'answer-pending' && msg.text && (
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
                  msg.type === 'question' || msg.type === 'question-pending'
                    ? 'self-end bg-blue-100 text-blue-900'
                    : 'self-start bg-green-100 text-green-900'
                }`}
              >
                {msg.type === 'question-pending' ? (
                  <span className="text-current">
                    <span className="typing-dots">
                      <span></span><span></span><span></span>
                    </span>
                  </span>
                ) : (
                  msg.text
                )}
              </div>
            )
          )}
          <div ref={chatEndRef} />
        </div>

        {/* 하단 바 */}
        {!isRecording ? (
          <div className="w-full flex items-center gap-2 px-3 py-2 sticky bottom-0 bg-white">
            <UIButton
              className={`w-14 h-14 aspect-square rounded-full p-0 flex-none grid place-items-center shadow transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 ${
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
            {/* 녹음 중 시각적 피드백 */}
            <div className="flex items-center justify-center mb-3">
              <RecordingEqualizer label="녹음 중입니다..." />
            </div>
            
            <UIButton className="w-full h-12 rounded-full font-bold text-[17px] text-zinc-800 bg-yellow-300 shadow"
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
      
      {/* 피드백 모달 */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        summaryText={summaryText}
        docId={docId}
      />
    </div>
  );
}
