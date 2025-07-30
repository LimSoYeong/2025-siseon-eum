// // RoleSelectPage.js
// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';

// export default function RoleSelectPage() {
//   const [role, setRole] = useState(null);
//   const navigate = useNavigate();

//   const handleContinue = () => {
//     if (role) navigate('/home');
//   };

//   return (
//     <div style={styles.bg}>
//       <div style={styles.box}>
//         <div style={styles.subTitle}>노인 친화형 문서이해 서비스</div>
//         <div style={styles.title}>누가 사용하시나요?</div>
//         <div style={styles.subdesc}>역할은 이후 설정에서 변경할 수 있어요</div>

//         <button
//           style={{
//             ...styles.btn,
//             border: role === 'senior' ? '2px solid #111' : '1.5px solid #ddd',
//             background: '#fff',
//             color: '#111',
//             fontWeight: 600
//           }}
//           onClick={() => setRole('senior')}
//         >
//           <span style={styles.roleMain}>어르신</span>
//           <span style={styles.roleSub}>문서를 쉽게 설명해드려요</span>
//         </button>
//         <button
//           style={{
//             ...styles.btn,
//             border: role === 'guardian' ? '2px solid #111' : '1.5px solid #ddd',
//             background: '#fff',
//             color: '#111',
//             fontWeight: 600
//           }}
//           onClick={() => setRole('guardian')}
//         >
//           <span style={styles.roleMain}>보호자</span>
//           <span style={styles.roleSub}>어르신 활동을 모니터링할 수 있어요</span>
//         </button>

//         <button
//           style={{
//             ...styles.continueBtn,
//             background: '#F8F9FA',
//             color: role ? '#111' : '#bbb',
//             cursor: role ? 'pointer' : 'default'
//           }}
//           disabled={!role}
//           onClick={handleContinue}
//         >
//           계속하기
//         </button>
//       </div>
//     </div>
//   );
// }

// const styles = {
//   bg: {
//     minHeight: '100vh',
//     background: '#fff',
//     display: 'flex',
//     justifyContent: 'center',
//     alignItems: 'center'
//   },
//   box: {
//     width: 320,
//     background: '#fff',
//     borderRadius: 18,
//     border: '4px solid #F2F3F6',
//     boxShadow: '0 6px 16px 0 rgba(40, 144, 255, 0.05)',
//     display: 'flex',
//     flexDirection: 'column',
//     alignItems: 'center',
//     padding: '36px 0 40px 0'
//   },
//   subTitle: {
//     color: '#969696',
//     fontSize: 16,
//     fontWeight: 500,
//     marginBottom: 15
//   },
//   title: {
//     fontSize: 38,
//     fontWeight: 700,
//     letterSpacing: '-2px',
//     marginBottom: 13
//   },
//   subdesc: {
//     fontSize: 16,
//     color: '#969696',
//     marginBottom: 30,
//     fontWeight: 400,
//     textAlign: 'center'
//   },
//   btn: {
//     width: 280,
//     borderRadius: 10,
//     padding: '15px 0 10px 0',
//     marginBottom: 14,
//     background: '#fff',
//     display: 'flex',
//     flexDirection: 'column',
//     alignItems: 'flex-start',
//     transition: 'all .2s',
//     cursor: 'pointer',
//     outline: 'none',
//     fontSize: 17
//   },
//   roleMain: {
//     fontWeight: 700,
//     fontSize: 17,
//     marginBottom: 3,
//     marginLeft: 2
//   },
//   roleSub: {
//     fontSize: 14.2,
//     color: '#444',
//     marginLeft: 2
//   },
//   continueBtn: {
//     width: 280,
//     height: 48,
//     border: 'none',
//     borderRadius: 9,
//     fontSize: 19,
//     fontWeight: 700,
//     marginTop: 28,
//     background: '#E9EBEF',
    
//   }
// };

