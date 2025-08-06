import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Splash from './pages/Splash';
import HomeScreen from './pages/HomeScreen';
import CameraScreen from './pages/CameraScreen'; 
import LoadingPage from './pages/LoadingPage';
import SummaryPage from './pages/SummaryPage';


function App() {
  return (
    // 여기서 flex 중앙정렬 div로 전체 감싸기!
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#fff"
      }}
    >
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
  );
}
export default App;

