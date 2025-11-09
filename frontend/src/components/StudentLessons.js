import React, { useState, useEffect } from 'react'
import './StudentLessons.css'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'

function StudentLessons() {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [tests, setTests] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLessons()
  }, [])

  const fetchLessons = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/student/lessons`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        setLessons(data.lessons)
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

  const handleLessonClick = async (lesson) => {
    setSelectedLesson(lesson)
    setError('')
    
    // O derse ait sınavları getir
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/student/tests/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        // Sadece seçilen derse ait sınavları filtrele
        const lessonTests = data.tests.filter(t => t.lesson && t.lesson.id === lesson.id)
        setTests(lessonTests)
      }
    } catch (err) {
      console.error('Sınavlar yüklenirken hata:', err)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('tr-TR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return React.createElement('div', { className: 'student-lessons-container' },
    // Sol sidebar - Ders listesi
    React.createElement('div', { className: 'student-lessons-sidebar' },
      React.createElement('h3', { className: 'sidebar-title' }, 'Derslerim'),

      loading && React.createElement('p', { className: 'loading-text' }, 'Yükleniyor...'),

      !loading && lessons.length === 0 && React.createElement('p', { className: 'empty-text' }, 
        'Henüz ders kaydınız bulunmamaktadır.'
      ),

      !loading && lessons.length > 0 && React.createElement('div', { className: 'lesson-list' },
        lessons.map(lesson =>
          React.createElement('div', {
            key: lesson.id,
            className: `lesson-item ${selectedLesson && selectedLesson.id === lesson.id ? 'selected' : ''}`,
            onClick: () => handleLessonClick(lesson)
          },
            React.createElement('div', { className: 'lesson-name' }, lesson.name),
            React.createElement('div', { className: 'lesson-code' }, lesson.code),
            lesson.grade && lesson.grade.total_score !== null && 
              React.createElement('div', { className: 'lesson-grade' }, 
                `Not: ${lesson.grade.total_score.toFixed(2)}`
              )
          )
        )
      )
    ),

    // Sağ taraf - Ders detayları
    React.createElement('div', { className: 'student-lesson-content' },
      error && React.createElement('div', { className: 'error-message' }, error),

      !selectedLesson && !loading && lessons.length > 0 && 
        React.createElement('div', { className: 'empty-state' },
          React.createElement('h3', null, 'Ders Seçin'),
          React.createElement('p', null, 'Soldaki listeden bir ders seçerek detayları görüntüleyin.')
        ),

      selectedLesson && React.createElement('div', { className: 'lesson-detail-box' },
        React.createElement('h2', { className: 'detail-title' }, selectedLesson.name),
        React.createElement('p', { className: 'detail-code' }, `Ders Kodu: ${selectedLesson.code}`),
        
        // Notlar Bölümü
        React.createElement('div', { className: 'detail-section' },
          React.createElement('h3', null, 'Notlarım'),
          selectedLesson.grade ? 
            React.createElement('div', { className: 'grades-grid' },
              React.createElement('div', { className: 'grade-card' },
                React.createElement('div', { className: 'grade-label' }, `Vize (%${selectedLesson.vize_weight || 40})`),
                React.createElement('div', { className: 'grade-value' }, 
                  selectedLesson.grade.vize_score !== null ? selectedLesson.grade.vize_score : 'Henüz girilmedi'
                )
              ),
              React.createElement('div', { className: 'grade-card' },
                React.createElement('div', { className: 'grade-label' }, `Final (%${selectedLesson.final_weight || 60})`),
                React.createElement('div', { className: 'grade-value' }, 
                  selectedLesson.grade.final_score !== null ? selectedLesson.grade.final_score : 'Henüz girilmedi'
                )
              ),
              React.createElement('div', { className: 'grade-card total' },
                React.createElement('div', { className: 'grade-label' }, 'Ortalama'),
                React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                  React.createElement('div', { className: 'grade-value' }, 
                    selectedLesson.grade.total_score !== null ? selectedLesson.grade.total_score.toFixed(2) : 'Henüz hesaplanmadı'
                  ),
                  // Sınıf ortalaması ile karşılaştırma
                  selectedLesson.grade.total_score !== null && selectedLesson.class_average !== null && React.createElement('div', { 
                    style: { 
                      fontSize: '13px', 
                      fontWeight: '500',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: selectedLesson.grade.total_score >= selectedLesson.class_average ? '#d1fae5' : '#fee2e2',
                      color: selectedLesson.grade.total_score >= selectedLesson.class_average ? '#065f46' : '#991b1b',
                      textAlign: 'center'
                    }
                  }, (() => {
                    const studentScore = selectedLesson.grade.total_score
                    const classAvg = selectedLesson.class_average
                    const diff = ((studentScore - classAvg) / classAvg * 100).toFixed(1)
                    
                    if (studentScore > classAvg) {
                      return `Sınıf ort. ${classAvg.toFixed(2)} - %${Math.abs(diff)} daha iyi`
                    } else if (studentScore < classAvg) {
                      return `Sınıf ort. ${classAvg.toFixed(2)} - %${Math.abs(diff)} daha düşük`
                    } else {
                      return `Sınıf ortalamasında (${classAvg.toFixed(2)})`
                    }
                  })())
                )
              )
            ) :
            React.createElement('p', { className: 'empty-text' }, 'Bu ders için henüz not girilmemiş.')
        ),

        // Sınavlar Bölümü
        React.createElement('div', { className: 'detail-section' },
          React.createElement('h3', null, 'Sınavlar'),
          tests.length > 0 ?
            React.createElement('div', { className: 'tests-list' },
              tests.map(test =>
                React.createElement('div', { key: test.id, className: 'test-card' },
                  React.createElement('div', { className: 'test-header' },
                    React.createElement('span', { className: 'test-type' }, 
                      test.test_type === 'vize' ? 'Vize' : test.test_type === 'final' ? 'Final' : 'Quiz'
                    ),
                    React.createElement('span', { className: `test-status ${test.attempt_status || 'available'}` },
                      test.attempt_status === 'submitted' ? 'Tamamlandı' : 
                      test.attempt_status === 'started' ? 'Devam Ediyor' : 'Aktif'
                    )
                  ),
                  React.createElement('div', { className: 'test-info' },
                    React.createElement('div', null, '📅 Başlangıç: ', formatDate(test.start_time)),
                    React.createElement('div', null, '🕐 Bitiş: ', formatDate(test.end_time)),
                    React.createElement('div', null, '⏱️ Süre: ', Math.floor(test.duration / 60), ' dakika')
                  )
                )
              )
            ) :
            React.createElement('p', { className: 'empty-text' }, 'Bu ders için aktif sınav bulunmamaktadır.')
        )
      )
    )
  )
}

export default StudentLessons

