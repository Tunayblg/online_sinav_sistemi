import React, { useState, useEffect } from 'react'
import './TeacherDashboard.css'
import TeacherLessons from './TeacherLessons'
import TeacherExams from './TeacherExams'
import TeacherGrades from './TeacherGrades'

function TeacherDashboard({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('derslerim')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    onLogout()
  }

  const formatDate = (date) => {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return React.createElement('div', { className: 'teacher-container' },
    // Sidebar
    React.createElement('div', { className: 'teacher-sidebar' },
      // Başlık, tarih ve saat
      React.createElement('div', { className: 'sidebar-header' },
        React.createElement('img', { 
          src: '/kostu_yuvarlak_logo_turkce.png', 
          alt: 'KOSTÜ',
          className: 'sidebar-logo'
        }),
        React.createElement('h2', { className: 'welcome-text' }, `Hoş geldiniz, ${user.full_name}!`),
        React.createElement('p', { className: 'user-role' }, 'Öğretim Görevlisi'),
        React.createElement('div', { className: 'current-date' }, formatDate(currentTime)),
        React.createElement('div', { className: 'current-time' }, formatTime(currentTime))
      ),

      // Menü
      React.createElement('nav', { className: 'sidebar-menu' },
        React.createElement('button', {
          className: `menu-item ${activeMenu === 'derslerim' ? 'active' : ''}`,
          onClick: () => setActiveMenu('derslerim')
        }, 'Derslerim'),
        React.createElement('button', {
          className: `menu-item ${activeMenu === 'sinavlar' ? 'active' : ''}`,
          onClick: () => setActiveMenu('sinavlar')
        }, 'Sınavlar'),
        React.createElement('button', {
          className: `menu-item ${activeMenu === 'notlar' ? 'active' : ''}`,
          onClick: () => setActiveMenu('notlar')
        }, 'Notlar')
      ),

      // Çıkış butonu
      React.createElement('button', {
        className: 'logout-button',
        onClick: handleLogout
      }, 'Çıkış Yap')
    ),

    // Ana içerik alanı
    React.createElement('div', { className: 'teacher-content' },
      activeMenu === 'derslerim' && React.createElement(TeacherLessons),
      activeMenu === 'sinavlar' && React.createElement(TeacherExams),
      activeMenu === 'notlar' && React.createElement(TeacherGrades)
    )
  )
}

export default TeacherDashboard

