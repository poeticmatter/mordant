import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as SelvedgeTagsApp } from './ui/App.tsx';
import { WorkshopApp } from './workshop/ui/WorkshopApp.tsx';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing the #root element');

// The workshop (v9) is the current playtest; v8 stays reachable at #v8 for comparison.
const isV8 = window.location.hash === '#v8';

createRoot(root).render(<StrictMode>{isV8 ? <SelvedgeTagsApp /> : <WorkshopApp />}</StrictMode>);
