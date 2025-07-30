// import React from 'react';
// import { useNavigate } from 'react-router-dom';

// export default function HomeScreen() {
//   const navigate = useNavigate();

//   const handleStartCamera = () => {
//     navigate('/camera');
//   };

//   return (
//     <div style={styles.container}>
//       <h1 style={styles.title}>📱 시선이음 보는 것에서, 이해로. 시선을 잇다.</h1>
//       <button style={styles.button} onClick={handleStartCamera}>
//         Start Camera
//       </button>
//     </div>
//   );
// }

// const styles = {
//   container: {
//     minHeight: '100vh', display: 'flex', flexDirection: 'column',
//     justifyContent: 'center', alignItems: 'center', padding: 20
//   },
//   title: {
//     fontSize: 24, marginBottom: 20
//   },
//   button: {
//     fontSize: 18, padding: '12px 32px', borderRadius: 10, border: 'none',
//     background: '#222', color: '#fff', cursor: 'pointer'
//   }
// };

// -----------------------------------
// 디자인 수정본 HomeScreen.js 파일 코드 

import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomeScreen() {
  const navigate = useNavigate();

  const handleStartCamera = () => {
    navigate('/camera');
  };

  const docs = [
    { date: '25.07.02', title: '대학병원 약봉투' },
    { date: '25.07.01', title: '건강보험 납부' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.recentTitle}>최근 찍은 문서 보기</div>
      <div style={styles.docsWrap}>
        {docs.map((doc, i) => (
          <div key={i} style={styles.docCard}>
            <div>
              <div style={styles.docDate}>{doc.date}</div>
              <div style={styles.docTitle}>{doc.title}</div>
            </div>
            <div style={styles.docThumbnail}></div>
          </div>
        ))}
      </div>
      <button style={styles.cameraBtn} onClick={handleStartCamera}>
        <span style={styles.cameraIcon} role="img" aria-label="camera">📷</span>
        문서 촬영하기
      </button>
    </div>
  );
}

const styles = {
  container: {
    width: 320,
    minHeight: '80vh',
    margin: '40px auto',
    border: '4px solid #eee',
    borderRadius: 18,
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    padding: '38px 0 38px 0',  // 아래 패딩 넉넉히!
    position: 'relative',
  },
  recentTitle: {
    fontWeight: 600,
    fontSize: 16,
    marginBottom: 14,
    alignSelf: 'flex-start',
    paddingLeft: 20
  },
  docsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    marginBottom: 34,
    padding: '0 20px', // 카드가 절대 안튀어나가게
    boxSizing: 'border-box'
  },
  docCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1.2px solid #ddd',
    borderRadius: 12,
    padding: '12px 14px',
    background: '#fff',
    boxShadow: '0 2px 6px 0 rgba(30,30,30,0.03)',
    width: '100%',
    boxSizing: 'border-box'
  },
  docDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: 500,
  },
  docThumbnail: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: '#444',
    marginLeft: 8,
  },
  buttonWrap: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    marginTop: 30 
  },
  cameraBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: 240,
    height: 42,
    fontSize: 16,
    fontWeight: 500,
    border: '1.5px solid #222',
    borderRadius: 8,
    background: '#fff',
    color: '#222',
    cursor: 'pointer',
    justifyContent: 'center',
    boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)'
  },
  cameraIcon: {
    fontSize: 20,
    marginRight: 5,
  }
};