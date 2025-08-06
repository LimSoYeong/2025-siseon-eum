import React from 'react';


export default function AnswerPage() {
  return (
    <div style={styles.container}>
      <div style={styles.text}>💬 분석된 답변 결과</div>
      <div style={styles.resultText}>여기에 음성 분석 결과가 표시될 예정입니다.</div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    background: '#fff'
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12
  },
  resultText: {
    marginTop: 20,
    fontSize: 15,
    color: '#555',
  }
};
