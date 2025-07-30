import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { register } from './serviceWorkerRegistration';
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(<App />);

// :흰색_확인_표시: PWA 서비스워커 등록
register();