import React, { useState, useEffect } from 'react'
import './StudentDashboard.css'
import StudentLessons from './StudentLessons'
import StudentExams from './StudentExams'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'

function StudentDashboard({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('derslerim')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [upcomingExamsCount, setUpcomingExamsCount] = useState(0)
  const [examMode, setExamMode] = useState(false) // Full-screen sınav modu
  const [examData, setExamData] = useState(null) // Sınav verileri (test, questions, etc.)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchUpcomingExams()
    const interval = setInterval(fetchUpcomingExams, 60000) // Her dakika kontrol et
    return () => clearInterval(interval)
  }, [])

  const fetchUpcomingExams = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/student/tests/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        // Aktif ve başlamamış sınavları say
        const now = new Date()
        const upcoming = (data.tests || []).filter(test => {
          const start = new Date(test.start_time)
          const end = new Date(test.end_time)
          return test.attempt_status !== 'submitted' && now >= start && now <= end
        })
        setUpcomingExamsCount(upcoming.length)
      }
    } catch (err) {
      console.error('Sınavlar kontrol edilirken hata:', err)
    }
  }

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

  const handleEnterExam = (data) => {
    console.log('📦 handleEnterExam çağrıldı, data:', data)
    setExamData(data)
    setExamMode(true)
  }

  const handleExitExam = () => {
    console.log('🚪 handleExitExam çağrıldı')
    setExamMode(false)
    setExamData(null)
    setActiveMenu('sinavlarim')
    fetchUpcomingExams() // Sınavları yenile
  }

  // Sınav modundaysa sadece sınav ekranını göster (sidebar yok)
  if (examMode && examData) {
    console.log('🎯 Sınav modu aktif, examData:', examData)
    return React.createElement('div', { 
      className: 'exam-fullscreen-container',
      style: {
        width: '100vw',
        height: '100vh',
        overflow: 'auto',
        backgroundColor: '#f5f5f5'
      }
    },
      React.createElement(StudentExams, { 
        examMode: true,
        onExitExam: handleExitExam,
        initialExamData: examData // Sınav verilerini prop olarak gönder
      })
    )
  }

  return React.createElement('div', { className: 'student-container' },
    // Sidebar
    React.createElement('div', { className: 'student-sidebar' },
      // Başlık, tarih ve saat
      React.createElement('div', { className: 'sidebar-header' },
        React.createElement('img', { 
          src: '/kostu_yuvarlak_logo_turkce.png', 
          alt: 'KOSTÜ',
          className: 'sidebar-logo'
        }),
        React.createElement('h2', { className: 'welcome-text' }, `Hoş geldiniz, ${user.full_name}!`),
        React.createElement('p', { className: 'user-role' }, 'Öğrenci'),
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
          className: `menu-item ${activeMenu === 'sinavlarim' ? 'active' : ''}`,
          onClick: () => setActiveMenu('sinavlarim')
        }, 
          'Sınavlarım',
          upcomingExamsCount > 0 && React.createElement('span', { className: 'exam-badge' }, upcomingExamsCount)
        )
      ),

      // Çıkış butonu
      React.createElement('button', {
        className: 'logout-button',
        onClick: handleLogout
      }, 'Çıkış Yap')
    ),

    // Ana içerik alanı
    React.createElement('div', { className: 'student-content' },
      activeMenu === 'derslerim' && React.createElement(StudentLessons),
      activeMenu === 'sinavlarim' && React.createElement(StudentExams, {
        examMode: false,
        onEnterExam: handleEnterExam
      })
    )
  )
}

export default StudentDashboard

