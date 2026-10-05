import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QuickCapturePopup } from './QuickCapturePopup';
import { ApplicationErrorBoundary } from '../components/ApplicationErrorBoundary';
import '../index.css';
import '../App.css';
import './popup.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ApplicationErrorBoundary browserTheme><QuickCapturePopup /></ApplicationErrorBoundary></StrictMode>,
);
