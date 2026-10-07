import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SPOTTodoElDeporte from './pages/SPOTTodoElDeporte';
import './global.css';

// Los enlaces todavía no tienen destino: evitamos que "#" salte al inicio de la página.
document.addEventListener('click', (event) => {
  const link = (event.target as Element).closest('a[href="#"]');
  if (link) event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SPOTTodoElDeporte />
  </StrictMode>,
);
