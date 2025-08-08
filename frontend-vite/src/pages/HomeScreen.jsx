import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomeScreen() {
  const navigate = useNavigate();

  const handleStartCamera = () => {
    navigate('/camera');
  };

  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/recent_docs`, {
          credentials: 'include'
        });
        const data = await res.json();
        const items = (data.items || []).map(it => ({
          date: new Date((it.mtime || 0) * 1000).toLocaleDateString('ko-KR').slice(2),
          title: it.title || '문서',
          thumb: `${import.meta.env.VITE_API_URL}/api/image?path=${encodeURIComponent(it.path || '')}`
        }));
        setDocs(items);
      } catch (e) {
        setDocs([]);
      }
    };
    fetchDocs();
  }, []);

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
            <div style={styles.docThumbnail}>
              {doc.thumb && (
                <img src={doc.thumb} alt="thumb" style={{width: '100%', height:'100%', objectFit:'cover', borderRadius:8}} />
              )}
            </div>
          </div>
        ))}
      </div>
      <button style={styles.cameraBtn} onClick={handleStartCamera}>
        <span style={styles.cameraIcon} role="img" aria-label="camera">📷</span>
        문서 촬영
      </button>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    maxWidth: 480,
    minHeight: '100vh',
    margin: '0 auto',
    borderRadius: 0,
    background: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    boxSizing: 'border-box',
    padding: '20px 0 20px 0',
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
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    marginBottom: 0,
    padding: '0 20px 80px 20px', // 하단 버튼 공간 확보
    boxSizing: 'border-box',
  },
  docCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1.2px solid rgba(200,200,200,0.3)',
    borderRadius: 12,
    padding: '20px 20px',
    background: 'var(--bg-color)',
    boxShadow: '0 2px 6px 0 rgba(30,30,30,0.03)',
    width: '100%',
    boxSizing: 'border-box'
  },
  docDate: {
    fontSize: 15,
    color: 'var(--font-color)',
    marginBottom: 2,
  },
  docTitle: {
    fontSize: 20,
    fontWeight: 500,
  },
  docThumbnail: {
    width: 50,
    height: 50,
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
    width: 'calc(100% - 40px)',
    height: 55,
    fontSize: 20,
    fontWeight: 500,
    border: '1.5px solid #222',
    borderRadius: 8,
    background: 'var(--bg-color)',
    color: 'var(--font-color)',
    cursor: 'pointer',
    justifyContent: 'center',
    boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
    margin: '12px 20px 12px 20px',
  },
  cameraIcon: {
    fontSize: 25,
    marginRight: 5,
  }
};