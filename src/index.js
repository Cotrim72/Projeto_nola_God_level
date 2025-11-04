import React from 'react';
import { createRoot } from 'react-dom/client';
// CORREÇÃO: Mudar o caminho de '../App.jsx' para './App.jsx'
// Isso assume que você moveu o App.jsx para dentro da pasta src/.
import App from './App.jsx';

// Este é o ponto de entrada da sua aplicação React
const container = document.getElementById('root');
const root = createRoot(container); 

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

