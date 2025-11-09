import React, { useState } from 'react'
import './Login.css'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Giriş başarısız')
      }
      
      // Token'ları kaydet
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      
      if (onLoginSuccess) {
        onLoginSuccess(data.user)
      }
    } catch (err) {
      setError(err.message || 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }
  
  return React.createElement('div', { className: 'login-container' },
    React.createElement('div', { className: 'login-box' },
      React.createElement('img', { 
        src: '/kostu_yuvarlak_logo_turkce.png', 
        alt: 'Kocaeli Sağlık ve Teknoloji Üniversitesi',
        className: 'login-logo'
      }),
      React.createElement('h1', { className: 'login-title' }, 'Online Sınav Sistemi'),
      React.createElement('h2', { className: 'login-subtitle' }, 'Giriş Yap'),
      
      error && React.createElement('div', { className: 'error-message' }, error),
      
      React.createElement('form', { onSubmit: handleSubmit, className: 'login-form' },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: 'email' }, 'Email'),
          React.createElement('input', {
            type: 'email',
            id: 'email',
            value: email,
            onChange: (e) => setEmail(e.target.value),
            required: true,
            placeholder: 'Email adresiniz'
          })
        ),
        
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: 'password' }, 'Şifre'),
          React.createElement('input', {
            type: 'password',
            id: 'password',
            value: password,
            onChange: (e) => setPassword(e.target.value),
            required: true,
            placeholder: 'Şifreniz'
          })
        ),
        
        React.createElement('button', {
          type: 'submit',
          className: 'login-button',
          disabled: loading
        }, loading ? 'Giriş yapılıyor...' : 'Giriş Yap')
      )
    )
  )
}

export default Login

