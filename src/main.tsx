import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {Store} from './lib/store';
import App from './App';
import './styles.css';
import './experience.css';
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><Store><App/></Store></BrowserRouter></StrictMode>);
