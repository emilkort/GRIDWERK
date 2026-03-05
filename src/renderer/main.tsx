import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/styles/globals.css'

// Apply saved theme before first render to avoid flash
const savedTheme = localStorage.getItem('gridwerk-theme') || 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
