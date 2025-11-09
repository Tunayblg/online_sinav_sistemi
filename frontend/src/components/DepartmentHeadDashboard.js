import React, { useState, useEffect } from 'react'
import './DepartmentHeadDashboard.css'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'

function DepartmentHeadDashboard({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('dersler') // 'dersler', 'notlar', 'ogretmenler'
  const [lessons, setLessons] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [lessonDetails, setLessonDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    fetchLessons()
    fetchTeachers()
    
    // Saat güncelleme
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchLessons = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/department-head/lessons`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      
      if (response.ok) {
        setLessons(data.lessons || [])
      } else {
        setError(data.error || 'Dersler yüklenirken hata oluştu')
      }
      setLoading(false)
    } catch (err) {
      console.error('Dersler yüklenirken hata:', err)
      setError('Dersler yüklenirken hata oluştu')
      setLoading(false)
    }
  }

  const fetchTeachers = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/department-head/teachers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      
      if (response.ok) {
        setTeachers(data.teachers || [])
      } else {
        setError(data.error || 'Öğretmenler yüklenirken hata oluştu')
      }
    } catch (err) {
      console.error('Öğretmenler yüklenirken hata:', err)
      setError('Öğretmenler yüklenirken hata oluştu')
    }
  }

  const fetchLessonDetails = async (lessonId) => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/department-head/lessons/${lessonId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      
      if (response.ok) {
        setLessonDetails(data)
        setSelectedLesson(lessonId)
      } else {
        setError(data.error || 'Ders detayları yüklenirken hata oluştu')
      }
    } catch (err) {
      console.error('Ders detayları yüklenirken hata:', err)
      setError('Ders detayları yüklenirken hata oluştu')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    onLogout()
  }

  const formatScore = (score) => {
    return score !== null && score !== undefined ? score.toFixed(2) : '-'
  }

  const formatDate = (date) => {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return React.createElement('div', { className: 'dept-head-container' },
    // Sidebar
    React.createElement('div', { className: 'dept-head-sidebar' },
      React.createElement('div', { className: 'sidebar-header' },
        React.createElement('img', { 
          src: '/kostu_yuvarlak_logo_turkce.png', 
          alt: 'KOSTÜ',
          className: 'sidebar-logo'
        }),
        React.createElement('h2', { className: 'welcome-text' }, `Hoş geldiniz, ${user.full_name}!`),
        React.createElement('p', { className: 'user-role' }, 'Bölüm Başkanı'),
        React.createElement('div', { className: 'current-date' }, formatDate(currentTime)),
        React.createElement('div', { className: 'current-time' }, formatTime(currentTime))
      ),

      // Menü butonları
      React.createElement('nav', { className: 'sidebar-menu' },
        React.createElement('button', {
          className: `menu-item ${activeMenu === 'dersler' ? 'active' : ''}`,
          onClick: () => {
            setActiveMenu('dersler')
            setSelectedLesson(null)
            setLessonDetails(null)
          }
        }, 'Dersler'),
        React.createElement('button', {
          className: `menu-item ${activeMenu === 'notlar' ? 'active' : ''}`,
          onClick: () => setActiveMenu('notlar')
        }, 'Notlar'),
        React.createElement('button', {
          className: `menu-item ${activeMenu === 'ogretmenler' ? 'active' : ''}`,
          onClick: () => setActiveMenu('ogretmenler')
        }, 'Öğretim Görevlileri')
      ),

      React.createElement('button', {
        className: 'logout-button',
        onClick: handleLogout
      }, 'Çıkış Yap')
    ),

    // Ana içerik
    React.createElement('div', { className: 'dept-head-content' },
      error && React.createElement('div', { className: 'error-message' }, error),

      loading && React.createElement('p', { className: 'loading-text' }, 'Yükleniyor...'),

      // DERSLER SEKMESİ
      !loading && activeMenu === 'dersler' && (
        // Ders listesi
        !selectedLesson ? React.createElement('div', { className: 'lessons-view' },
          React.createElement('h2', { className: 'page-title' }, 'Dersler'),
          React.createElement('div', { className: 'cards-grid' },
            lessons.map(lesson =>
              React.createElement('div', {
                key: lesson.id,
                className: 'lesson-card',
                onClick: () => fetchLessonDetails(lesson.id)
              },
                React.createElement('h3', { className: 'card-title' }, lesson.name),
                lesson.teachers && lesson.teachers.length > 0 && React.createElement('div', { className: 'teacher-info' },
                  React.createElement('span', { style: { color: '#6b7280', fontSize: '13px' } }, 'Öğretim Görevlisi:'),
                  React.createElement('span', { style: { color: '#1f2937', fontSize: '14px', fontWeight: '600', marginTop: '4px' } }, 
                    lesson.teachers[0].full_name
                  )
                ),
                React.createElement('div', { className: 'card-stats' },
                  React.createElement('div', { className: 'stat-item' },
                    React.createElement('span', { className: 'stat-value' }, lesson.student_count),
                    React.createElement('span', { className: 'stat-label' }, 'Öğrenci')
                  ),
                  lesson.average_score !== null && React.createElement('div', { className: 'stat-item' },
                    React.createElement('span', { className: 'stat-value' }, formatScore(lesson.average_score)),
                    React.createElement('span', { className: 'stat-label' }, 'Ortalama')
                  )
                )
              )
            )
          )
        ) : 
        // Ders detayı
        React.createElement('div', { className: 'lesson-detail-view' },
          React.createElement('button', {
            className: 'back-button',
            onClick: () => {
              setSelectedLesson(null)
              setLessonDetails(null)
            }
          }, '← Geri'),
          
          lessonDetails && React.createElement('div', { className: 'detail-content' },
            React.createElement('h2', { className: 'detail-title' }, lessonDetails.lesson.name),
            React.createElement('div', { className: 'students-table-container' },
              React.createElement('table', { className: 'students-table' },
                React.createElement('thead', null,
                  React.createElement('tr', null,
                    React.createElement('th', null, 'Ad Soyad'),
                    React.createElement('th', null, 'Bölüm'),
                    React.createElement('th', null, 'Vize'),
                    React.createElement('th', null, 'Final'),
                    React.createElement('th', null, 'Ortalama')
                  )
                ),
                React.createElement('tbody', null,
                  lessonDetails.students.map(student =>
                    React.createElement('tr', { key: student.id },
                      React.createElement('td', null, student.full_name),
                      React.createElement('td', null, student.department || '-'),
                      React.createElement('td', null, 
                        student.grade ? formatScore(student.grade.vize_score) : '-'
                      ),
                      React.createElement('td', null, 
                        student.grade ? formatScore(student.grade.final_score) : '-'
                      ),
                      React.createElement('td', { className: 'score-cell' }, 
                        student.grade ? formatScore(student.grade.total_score) : '-'
                      )
                    )
                  )
                )
              )
            )
          )
        )
      ),

      // NOTLAR SEKMESİ
      !loading && activeMenu === 'notlar' && React.createElement('div', { className: 'averages-view' },
        React.createElement('h2', { className: 'page-title' }, 'Sınav Ortalamaları'),
        React.createElement('div', { className: 'cards-grid' },
          lessons.map(lesson =>
            React.createElement('div', { 
              key: lesson.id, 
              className: 'average-card'
            },
              React.createElement('h3', { className: 'card-title' }, lesson.name),
              React.createElement('div', { className: 'average-stats' },
                React.createElement('div', { className: 'stat-row' },
                  React.createElement('span', { className: 'stat-label' }, 'Genel Ortalama'),
                  React.createElement('span', { className: 'stat-value' }, 
                    lesson.average_score !== null ? formatScore(lesson.average_score) : '-'
                  )
                )
              )
            )
          )
        )
      ),

      // ÖĞRETİM GÖREVLİLERİ SEKMESİ
      !loading && activeMenu === 'ogretmenler' && React.createElement('div', { className: 'teachers-view' },
        React.createElement('h2', { className: 'page-title' }, 'Öğretim Görevlileri'),
        React.createElement('div', { className: 'cards-grid' },
          teachers.map(teacher =>
            React.createElement('div', { 
              key: teacher.id, 
              className: 'teacher-card'
            },
              React.createElement('div', { className: 'teacher-header' },
                React.createElement('h3', { className: 'card-title' }, teacher.full_name),
                React.createElement('div', { className: 'teacher-meta' },
                  React.createElement('span', { style: { fontSize: '13px', color: '#6b7280' } }, teacher.email),
                  React.createElement('span', { style: { fontSize: '14px', color: '#2c5f2d', fontWeight: '600', marginTop: '4px' } }, 
                    `${teacher.lesson_count} ders`
                  )
                )
              ),
              teacher.lessons && teacher.lessons.length > 0 && React.createElement('div', { className: 'teacher-lessons' },
                React.createElement('div', { style: { fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' } }, 
                  'Verdiği Dersler:'
                ),
                React.createElement('div', { className: 'lessons-list' },
                  teacher.lessons.map(lesson =>
                    React.createElement('div', { 
                      key: lesson.id, 
                      className: 'lesson-item'
                    },
                      React.createElement('span', { className: 'lesson-item-name' }, lesson.name),
                      React.createElement('span', { className: 'lesson-item-count' }, 
                        `${lesson.student_count} öğrenci`
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  )
}

export default DepartmentHeadDashboard
