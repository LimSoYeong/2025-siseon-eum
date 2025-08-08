// import React, { useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';

// export default function Splash() {
//   const navigate = useNavigate();

//   useEffect(() => {
//     // 1.5초 후 /start(시작화면)으로 이동
//     const timeout = setTimeout(() => {
//       navigate('/home');
//     }, 1500);
//     return () => clearTimeout(timeout);
//   }, [navigate]);

//   return (
//     <div style={styles.container}>
//       <h1 style={styles.title}>시선이음</h1>
//       <div style={styles.subtitle}>보는 것에서, 이해로. 시선을 잇다.</div>
//     </div>
//   );
// }

// const styles = {
//   container: {
//     width: '100%',
//     maxWidth: 400,
//     minHeight: '80vh',
//     margin: '40px auto',
//     // border: '4px solid #eee',  // 회색 테두리
//     borderRadius: 0,
//     background: 'var(--bg-color)',
//     display: 'flex',
//     flexDirection: 'column',
//     alignItems: 'center',
//     justifyContent: 'center',
//     boxSizing: 'border-box',
//     padding: '38px 0'
//   },
//   title: {
//     fontSize: 32,    // (로그인 시안 기준이면 32~36)
//     fontWeight: 700,
//     margin: '18px 0 30px 0',
//     letterSpacing: '-2px',
//     textAlign: 'center'
//   },
//   subtitle: {
//     fontSize: 15,
//     color: 'var(--font-color)',
//     textAlign: 'center',
//     marginBottom: 16
//   }
// };

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    // 1.5초 후 /home으로 이동
    const timeout = setTimeout(() => {
      navigate('/home');
    }, 1500);
    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="w-full max-w-[400px] min-h-[80vh] mx-auto flex flex-col items-center justify-center bg-[var(--bg-color)] p-[38px_0]">
      <h1 className="text-[32px] font-bold mt-[18px] mb-[30px] tracking-tight text-center">
        시선이음
      </h1>
      <div className="text-[15px] text-[var(--font-color)] text-center mb-4">
        보는 것에서, 이해로. 시선을 잇다.
      </div>
    </div>
  );
}
