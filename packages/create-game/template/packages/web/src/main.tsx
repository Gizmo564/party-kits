import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@gizmo564/lobby-ui/web';
import { applyTheme, savedTheme } from '@gizmo564/themes/web/theme';
import { App } from './App';
import './styles.css';

applyTheme('__SLUG__', savedTheme('__SLUG__'), false);   // the inline boot script already did this; this also sets the browser colour
createRoot(document.getElementById('root')!).render(<StrictMode><ToastProvider><App /></ToastProvider></StrictMode>);
