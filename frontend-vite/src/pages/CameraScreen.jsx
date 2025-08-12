// // CameraScreen.js

// import React, { useRef, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';

// export default function CameraScreen() {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const navigate = useNavigate();

//   // 📸 카메라 시작
//   useEffect(() => {
//     const startCamera = async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { facingMode:  'environment'  }, // 후면 카메라
//         });
//         videoRef.current.srcObject = stream;
//       } catch (err) {
//         alert('카메라 권한이 없거나 접근 실패');
//       }
//     };
//     startCamera();
//   }, []);

//   // 📷 사진 촬영 후 → blob 상태 전달
//   const takePhoto = () => {
//     const video = videoRef.current;
//     const canvas = canvasRef.current;
  
//     if (!video || !canvas) return;
  
//     // 💡 video가 준비 안 되었으면 촬영 막기
//     if (video.readyState < 2) {
//       alert('카메라가 아직 준비되지 않았습니다');
//       return;
//     }
  
//     const ctx = canvas.getContext('2d');
//     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
//     canvas.toBlob(blob => {
//       if (blob) {
//         navigate('/load', { state: { imageBlob: blob } });
//       } else {
//         alert('이미지 캡처 실패. 다시 시도해주세요.');
//       }
//     }, 'image/jpeg');
//   };

//   const goBack = () => navigate('/home', { replace: true });

//   return (
//     <div style={styles.wrapper}>
//       <video ref={videoRef} autoPlay playsInline style={styles.video} />
//       <canvas ref={canvasRef} width="360" height="640" style={{ display: 'none' }} />

//       {/* ← 뒤로가기 */}
//       <button style={styles.backButton} onClick={goBack}>← 뒤로가기</button>

//       {/* ● 촬영버튼 */}
//       <button style={styles.shutterButton} onClick={takePhoto} />
//     </div>
//   );
// }

// const styles = {
//   wrapper: {
//     position: 'relative',
//     width: '100%',
//     height: '100dvh',
//     overflow: 'hidden',
//     background: '#000',
//   },
//   video: {
//     width: '100%',
//     height: '100%',
//     objectFit: 'cover',
//   },
//   backButton: {
//     position: 'absolute',
//     top: 20,
//     left: 20,
//     padding: '8px 14px',
//     fontSize: 16,
//     backgroundColor: 'rgba(0,0,0,0.4)',
//     color: '#fff',
//     border: 'none',
//     borderRadius: 6,
//     zIndex: 10,
//   },
//   shutterButton: {
//     position: 'absolute',
//     bottom: 40,
//     left: '50%',
//     transform: 'translateX(-50%)',
//     width: 90,
//     height: 90,
//     borderRadius: '50%',
//     backgroundColor: '#fff',
//     border: '4px solid #ddd',
//     zIndex: 10,
//   },
// };

import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UIButton from '../components/common/UIButton';

export default function CameraScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // 후면 카메라
        });
        videoRef.current.srcObject = stream;
      } catch (err) {
        alert('카메라 권한이 없거나 접근 실패');
      }
    };
    startCamera();
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    if (video.readyState < 2) {
      alert('카메라가 아직 준비되지 않았습니다');
      return;
    }

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (blob) {
        navigate('/load', { state: { imageBlob: blob } });
      } else {
        alert('이미지 캡처 실패. 다시 시도해주세요.');
      }
    }, 'image/jpeg');
  };

  const goBack = () => navigate('/home', { replace: true });

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black">
      {/* 📷 카메라 영상 */}
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

      {/* 캡처용 캔버스 (숨김) */}
      <canvas ref={canvasRef} width="360" height="640" className="hidden" />

      {/* ← 뒤로가기 버튼 */}
      <UIButton
        onClick={goBack}
        className="absolute top-5 left-5 px-4 py-2 text-white text-base rounded-md z-10 bg-black/40"
      >
        ← 뒤로가기
      </UIButton>

      {/* ● 촬영 버튼 */}
      <UIButton
        onClick={takePhoto}
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 w-[90px] h-[90px] rounded-full bg-white border-[4px] border-gray-300 z-10"
      />
    </div>
  );
}
