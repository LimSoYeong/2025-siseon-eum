// src/api/summarize.js
export async function summarizeImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  // 실제 배포 시엔 process.env.REACT_APP_API_URL 등 환경변수로 빼도 됨
  const res = await fetch('http://localhost:8000/summarize/', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('요약 실패');
  return await res.json(); // { original_text, summary_text, audio_path }
}
