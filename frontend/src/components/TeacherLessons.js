import React, { useState, useEffect } from 'react'
import './TeacherLessons.css'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'

function TeacherLessons() {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [lessonDetail, setLessonDetail] = useState(null)
  const [studentsWithGrades, setStudentsWithGrades] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingWeights, setEditingWeights] = useState(false)
  const [weights, setWeights] = useState({
    vize_weight: 40,
    final_weight: 60
  })

  useEffect(() => {
    fetchLessons()
  }, [])

  const fetchLessons = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/teacher/lessons`, {
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
    
    // Ders detaylarını çek (ağırlıklar dahil)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/teacher/lessons/${lesson.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        setLessonDetail(data)
        setWeights({
          vize_weight: data.vize_weight || 40,
          final_weight: data.final_weight || 60
        })
        // Öğrencileri ve notlarını set et
        setStudentsWithGrades(data.students || [])
      }
    } catch (err) {
      console.error('Ders detayları yüklenirken hata:', err)
    }
  }

  const handleWeightChange = (field, value) => {
    // Boş string'i koruyalım, sadece sayıya çevirelim
    const numValue = value === '' ? '' : parseFloat(value)
    setWeights({ ...weights, [field]: numValue })
  }


  const handleSaveWeights = async () => {
    // Boş değerleri 0'a çevir
    const vizeWeight = parseFloat(weights.vize_weight) || 0
    const finalWeight = parseFloat(weights.final_weight) || 0
    
    // Toplam %100 kontrolü
    const total = vizeWeight + finalWeight
    if (Math.abs(total - 100) > 0.01) {
      setError('Vize + Final toplamı %100 olmalıdır!')
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      
      // Backend'e kaydet
      const response = await fetch(`${API_BASE_URL}/teacher/lessons/${selectedLesson.id}/weights`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vize_weight: vizeWeight,
          final_weight: finalWeight
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSuccess('Not ağırlıkları başarıyla güncellendi!')
        setEditingWeights(false)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Not ağırlıkları güncellenirken hata oluştu')
      }
    } catch (err) {
      console.error('Ağırlık güncelleme hatası:', err)
      setError('Not ağırlıkları güncellenirken hata oluştu')
    }
  }

  const PieChart = ({ vize, final }) => {
    // SVG ile pie chart
    const vizeNum = parseFloat(vize) || 0
    const finalNum = parseFloat(final) || 0
    const total = vizeNum + finalNum
    const vizePercent = total > 0 ? (vizeNum / total) * 100 : 0
    const finalPercent = total > 0 ? (finalNum / total) * 100 : 0
    
    // SVG circle için değerler
    const radius = 60
    const circumference = 2 * Math.PI * radius
    const vizeLength = (vizePercent / 100) * circumference
    const finalLength = (finalPercent / 100) * circumference
    
    return React.createElement('svg', { 
      width: '150', 
      height: '150', 
      viewBox: '0 0 150 150',
      className: 'pie-chart-svg'
    },
      // Arka plan çember
      React.createElement('circle', {
        cx: '75',
        cy: '75',
        r: radius,
        fill: 'none',
        stroke: '#e5e7eb',
        strokeWidth: '30'
      }),
      // Vize (mavi)
      React.createElement('circle', {
        cx: '75',
        cy: '75',
        r: radius,
        fill: 'none',
        stroke: '#3b82f6',
        strokeWidth: '30',
        strokeDasharray: `${vizeLength} ${circumference}`,
        strokeDashoffset: '0',
        transform: 'rotate(-90 75 75)',
        style: { transition: 'stroke-dasharray 0.5s ease' }
      }),
      // Final (yeşil)
      React.createElement('circle', {
        cx: '75',
        cy: '75',
        r: radius,
        fill: 'none',
        stroke: '#10b981',
        strokeWidth: '30',
        strokeDasharray: `${finalLength} ${circumference}`,
        strokeDashoffset: `-${vizeLength}`,
        transform: 'rotate(-90 75 75)',
        style: { transition: 'stroke-dasharray 0.5s ease' }
      })
    )
  }

  return React.createElement('div', { className: 'teacher-lessons-container' },
    // Sol sidebar - Ders listesi
    React.createElement('div', { className: 'teacher-lessons-sidebar' },
      React.createElement('h3', { className: 'sidebar-title' }, 'Derslerim'),

      loading && React.createElement('p', { className: 'loading-text' }, 'Yükleniyor...'),

      !loading && lessons.length === 0 && React.createElement('p', { className: 'empty-text' }, 
        'Henüz ders atanmamış. Lütfen admin ile iletişime geçin.'
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
            lesson.students && React.createElement('div', { className: 'student-count' },
              `👥 ${lesson.students.length} öğrenci`
            )
          )
        )
      )
    ),

    // Sağ taraf - Ders detayları
    React.createElement('div', { className: 'teacher-lesson-content' },
      error && React.createElement('div', { className: 'error-message' }, error),

      !selectedLesson && !loading && lessons.length > 0 && 
        React.createElement('div', { className: 'empty-state' },
          React.createElement('h3', null, 'Ders Seçin'),
          React.createElement('p', null, 'Soldaki listeden bir ders seçerek detayları görüntüleyin.')
        ),

      selectedLesson && React.createElement('div', { className: 'lesson-detail-box' },
        React.createElement('h2', { className: 'detail-title' }, selectedLesson.name),
        React.createElement('p', { className: 'detail-code' }, `Ders Kodu: ${selectedLesson.code}`),
        
        error && React.createElement('div', { className: 'error-message' }, error),
        success && React.createElement('div', { className: 'success-message' }, success),

        // Not Ağırlıkları Bölümü
        React.createElement('div', { className: 'detail-section weights-section' },
          React.createElement('div', { className: 'section-header' },
            React.createElement('h3', null, 'Not Ağırlıkları'),
            React.createElement('button', {
              className: 'edit-weights-btn',
              onClick: () => setEditingWeights(!editingWeights)
            }, editingWeights ? 'İptal' : 'Düzenle')
          ),

          React.createElement('div', { className: 'weights-container' },
            // Pie Chart
            React.createElement('div', { className: 'chart-container' },
              React.createElement(PieChart, {
                vize: weights.vize_weight,
                final: weights.final_weight
              }),
              React.createElement('div', { className: 'chart-legend' },
                React.createElement('div', { className: 'legend-item' },
                  React.createElement('span', { className: 'legend-color vize-color' }),
                  React.createElement('span', null, `Vize: %${parseFloat(weights.vize_weight) || 0}`)
                ),
                React.createElement('div', { className: 'legend-item' },
                  React.createElement('span', { className: 'legend-color final-color' }),
                  React.createElement('span', null, `Final: %${parseFloat(weights.final_weight) || 0}`)
                )
              )
            ),

            // Ağırlık Düzenleme Formu
            editingWeights && React.createElement('div', { className: 'weights-form' },
              React.createElement('div', { className: 'weight-input' },
                React.createElement('label', null, 'Vize (%)'),
                React.createElement('input', {
                  type: 'number',
                  min: 0,
                  max: 100,
                  value: weights.vize_weight,
                  onChange: (e) => handleWeightChange('vize_weight', e.target.value)
                })
              ),
              React.createElement('div', { className: 'weight-input' },
                React.createElement('label', null, 'Final (%)'),
                React.createElement('input', {
                  type: 'number',
                  min: 0,
                  max: 100,
                  value: weights.final_weight,
                  onChange: (e) => handleWeightChange('final_weight', e.target.value)
                })
              ),
              React.createElement('button', {
                className: 'save-weights-btn',
                onClick: handleSaveWeights
              }, 'Kaydet')
            )
          )
        ),

        // Öğrenci Notları Tablosu
        React.createElement('div', { className: 'detail-section' },
          React.createElement('h3', null, '👥 Öğrenci Notları'),
          studentsWithGrades && studentsWithGrades.length > 0 ?
            React.createElement('div', { className: 'grades-table-wrapper' },
              React.createElement('table', { className: 'grades-table' },
                React.createElement('thead', null,
                  React.createElement('tr', null,
                    React.createElement('th', null, 'Öğrenci No'),
                    React.createElement('th', null, 'Ad Soyad'),
                    React.createElement('th', null, `Vize (%${parseFloat(weights.vize_weight) || 0})`),
                    React.createElement('th', null, `Final (%${parseFloat(weights.final_weight) || 0})`),
                    React.createElement('th', null, 'Ortalama')
                  )
                ),
                React.createElement('tbody', null,
                  studentsWithGrades.map((student, idx) => {
                    const vizeScore = student.vize_score !== null ? student.vize_score : null
                    const finalScore = student.final_score !== null ? student.final_score : null
                    const totalScore = student.total_score !== null ? student.total_score : null
                    
                    return React.createElement('tr', { key: student.id || idx },
                      React.createElement('td', null, student.student_number),
                      React.createElement('td', null, student.full_name),
                      React.createElement('td', null,
                        vizeScore !== null ? vizeScore : 'x'
                      ),
                      React.createElement('td', null,
                        finalScore !== null ? finalScore : 'x'
                      ),
                      React.createElement('td', { className: 'average-cell' }, 
                        totalScore !== null ? totalScore.toFixed(2) : 'x'
                      )
                    )
                  })
                )
              )
            ) :
            React.createElement('p', { className: 'empty-text' }, 'Bu derse henüz öğrenci kaydedilmemiş.')
        )
      )
    )
  )
}

export default TeacherLessons

