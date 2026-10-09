import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import SPOTTodoElDeporte from './pages/SPOTTodoElDeporte';
import { useHashRoute } from './lib/hashRoute';
import './global.css';

// La página de entrenamiento trae MediaPipe: se descarga sólo cuando se abre.
const Entrenar = lazy(() => import('./pages/Entrenar'));

// Los enlaces todavía no tienen destino: evitamos que "#" salte al inicio de la página.
document.addEventListener('click', (event) => {
  const link = (event.target as Element).closest('a[href="#"]');
  if (link) event.preventDefault();
});

function App() {
  const route = useHashRoute();
  if (route !== 'entrenar') return <SPOTTodoElDeporte />;
  return (
    <Suspense fallback={<div className="route-loading" role="status">Cargando…</div>}>
      <Entrenar />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
