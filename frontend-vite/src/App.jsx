import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Splash from './pages/Splash'
import HomeScreen from './pages/HomeScreen'
import CameraScreen from './pages/CameraScreen' 
import LoadingPage from './pages/LoadingPage'
import SummaryPage from './pages/SummaryPage'
import { flushFeedbackQueue } from './utils/flushFeedbackQueue'


function App() {
  // 앱 시작 시 피드백 큐 처리
  useEffect(() => {
    flushFeedbackQueue().then((result) => {
      if (result && (result.successful > 0 || result.failed > 0)) {
        console.log(`Feedback queue processed: ${result.successful} successful, ${result.failed} failed`);
      }
    });
  }, []);

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-white">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/camera" element={<CameraScreen />} />
          <Route path="/load" element={<LoadingPage />} />
          <Route path="/summary" element={<SummaryPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}
export default App

