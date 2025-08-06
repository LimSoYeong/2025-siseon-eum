import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Splash from './pages/Splash';
import StartPage from './pages/StartPage';
import HomeScreen from './pages/HomeScreen';
import CameraScreen from './pages/CameraScreen'; 
import LoadingPage from './pages/LoadingPage';
import SummaryPage from './pages/SummaryPage';
import AnswerPage from './pages/AnswerPage';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/start" element={<StartPage />} />
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/camera" element={<CameraScreen />} />
        <Route path="/load" element={<LoadingPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/answer" element={<AnswerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
