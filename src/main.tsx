import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SPOTTodoElDeporte from './pages/SPOTTodoElDeporte';
import './global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SPOTTodoElDeporte />
  </StrictMode>,
);
