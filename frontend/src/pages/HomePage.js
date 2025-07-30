//필요없음. 



// import React from 'react';

// export default function HomePage() {
//   const docs = [
//     { id: 1, date: '25.07.02', title: '대학병원 약봉투' },
//     { id: 2, date: '25.07.01', title: '건강보험 납부' }
//   ];

//   return (
//     <div style={styles.bg}>
//       <div style={styles.box}>
//         <div style={styles.inner}>
//           <div style={styles.listTitle}>최근 찍은 문서 보기</div>
//           <div style={styles.docList}>
//             {docs.map(doc => (
//               <div key={doc.id} style={styles.docItem}>
//                 <div style={styles.docText}>
//                   <div style={styles.docDate}>{doc.date}</div>
//                   <div style={styles.docName}>{doc.title}</div>
//                 </div>
//                 <div style={styles.docThumb}></div>
//               </div>
//             ))}
//           </div>
//         </div>

//         <button style={styles.cameraBtn}>
//           <span role="img" aria-label="camera" style={{ marginRight: 8, fontSize: 19 }}>📷</span>
//           문서 촬영하기
//         </button>
//       </div>
//     </div>
//   );
// }

// const styles = {
//   bg: {
//     minHeight: '100vh',
//     width: '100vw',
//     background: '#fff',
//     display: 'flex',
//     justifyContent: 'center',
//     alignItems: 'center'
//   },
//   box: {
//     width: 420,
//     minHeight: 540,
//     background: '#f7f7f7',
//     border: '2px solid #eee',
//     borderRadius: 22,
//     boxShadow: '0 2px 12px #0001',
//     display: 'flex',
//     flexDirection: 'column',
//     justifyContent: 'space-between',
//     padding: '40px 0 32px 0',
//     boxSizing: 'border-box',
//     alignItems: 'stretch'
//   },
//   inner: {
//     flex: 1,
//   },
//   listTitle: {
//     fontWeight: 700,
//     fontSize: 20,
//     marginBottom: 20,
//     paddingLeft: 38,
//   },
//   docList: {
//     display: 'flex',
//     flexDirection: 'column',
//     gap: 16,
//     padding: '0 38px',
//   },
//   docItem: {
//     display: 'flex',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     padding: '18px 18px',
//     background: '#fff',
//     border: '2px solid #222',
//     borderRadius: 16,
//     minHeight: 76,
//     boxSizing: 'border-box'
//   },
//   docText: {
//     display: 'flex',
//     flexDirection: 'column',
//     alignItems: 'flex-start'
//   },
//   docDate: {
//     fontSize: 14,
//     fontWeight: 600,
//     color: '#666',
//     marginBottom: 4
//   },
//   docName: {
//     fontSize: 19,
//     fontWeight: 800,
//     color: '#222'
//   },
//   docThumb: {
//     width: 56,
//     height: 48,
//     background: '#333',
//     borderRadius: 10,
//     marginLeft: 18
//   },
//   cameraBtn: {
//     width: 'calc(100% - 76px)', // 좌우 여백 맞춤!
//     margin: '32px auto 0 auto',
//     border: '2px solid #222',
//     borderRadius: 12,
//     background: 'none',
//     fontWeight: 700,
//     fontSize: 17,
//     height: 48,
//     cursor: 'pointer',
//     display: 'flex',
//     alignItems: 'center',
//     justifyContent: 'center'
//   }
// };
