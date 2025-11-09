import React, { useState, useEffect } from 'react'
import './TeacherGrades.css'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'

function TeacherGrades() {
  const [lessons, setLessons] = useState([])
  const [lessonDetails, setLessonDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLessonsAndGrades()
  }, [])

  const fetchLessonsAndGrades = async () => {
    setLoading(true)
    setError('')
    
    try {
      const token = localStorage.getItem('access_token')
      
      // Önce dersleri çek
      const lessonsResponse = await fetch(`${API_BASE_URL}/teacher/lessons`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!lessonsResponse.ok) {
        throw new Error('Dersler yüklenemedi')
      }
      
      const lessonsData = await lessonsResponse.json()
      setLessons(lessonsData.lessons || [])
      
      // Her ders için detayları çek
      const details = {}
      for (const lesson of lessonsData.lessons || []) {
        const detailResponse = await fetch(`${API_BASE_URL}/teacher/lessons/${lesson.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          details[lesson.id] = {
            students: detailData.students || [],
            vize_weight: detailData.vize_weight || 40,
            final_weight: detailData.final_weight || 60
          }
        }
      }
      
      setLessonDetails(details)
      setLoading(false)
    } catch (err) {
      console.error('Notlar yüklenirken hata:', err)
      setError('Notlar yüklenirken bir hata oluştu')
      setLoading(false)
    }
  }

  const calculateAverage = (students) => {
    if (!students || students.length === 0) return null
    
    const validScores = students
      .map(s => s.total_score)
      .filter(score => score !== null && score !== undefined)
    
    if (validScores.length === 0) return null
    
    const sum = validScores.reduce((acc, score) => acc + score, 0)
    return (sum / validScores.length).toFixed(2)
  }

  if (loading) {
    return React.createElement('div', { className: 'teacher-grades-container' },
      React.createElement('div', { className: 'loading-state' },
        React.createElement('p', null, 'Notlar yükleniyor...')
      )
    )
  }

  if (error) {
    return React.createElement('div', { className: 'teacher-grades-container' },
      React.createElement('div', { className: 'error-message' }, error)
    )
  }

  if (lessons.length === 0) {
    return React.createElement('div', { className: 'teacher-grades-container' },
      React.createElement('div', { className: 'empty-state' },
        React.createElement('h3', null, 'Henüz ders kaydınız bulunmamaktadır')
      )
    )
  }

  // Tüm öğrencileri topla (tekrarsız)
  const allStudents = {}
  lessons.forEach(lesson => {
    const students = lessonDetails[lesson.id]?.students || []
    students.forEach(student => {
      if (!allStudents[student.id]) {
        allStudents[student.id] = {
          id: student.id,
          full_name: student.full_name,
          student_number: student.student_number,
          grades: {}
        }
      }
      allStudents[student.id].grades[lesson.id] = {
        vize_score: student.vize_score,
        final_score: student.final_score,
        total_score: student.total_score
      }
    })
  })

  const studentsList = Object.values(allStudents).sort((a, b) => 
    a.full_name.localeCompare(b.full_name, 'tr')
  )

  return React.createElement('div', { className: 'teacher-grades-container' },
    React.createElement('h2', { className: 'page-title' }, 'Öğrenci Notları'),

    React.createElement('div', { className: 'grades-table-wrapper' },
      React.createElement('table', { className: 'grades-table' },
        // Thead - Ders isimleri ve ortalamalar
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', { className: 'student-col', rowSpan: 2 }, 'Öğrenci'),
            React.createElement('th', { className: 'student-no-col', rowSpan: 2 }, 'No'),
            lessons.map(lesson =>
              React.createElement('th', { 
                key: lesson.id, 
                className: 'lesson-col',
                colSpan: 3
              }, lesson.name)
            )
          ),
          React.createElement('tr', null,
            lessons.map(lesson =>
              React.createElement(React.Fragment, { key: lesson.id },
                React.createElement('th', { className: 'grade-sub-col' }, 'Vize'),
                React.createElement('th', { className: 'grade-sub-col' }, 'Final'),
                React.createElement('th', { className: 'grade-sub-col total-col' }, 'Ortalama')
              )
            )
          ),
          React.createElement('tr', { className: 'average-row' },
            React.createElement('td', { colSpan: 2 }, 'Sınıf Ortalaması'),
            lessons.map(lesson => {
              const students = lessonDetails[lesson.id]?.students || []
              const avg = calculateAverage(students)
              
              return React.createElement(React.Fragment, { key: lesson.id },
                React.createElement('td', { className: 'average-cell' }, '-'),
                React.createElement('td', { className: 'average-cell' }, '-'),
                React.createElement('td', { className: 'average-cell total-avg' }, 
                  avg !== null ? avg : '-'
                )
              )
            })
          )
        ),

        // Tbody - Öğrenciler ve notları
        React.createElement('tbody', null,
          studentsList.length === 0 ?
            React.createElement('tr', null,
              React.createElement('td', { 
                colSpan: 2 + (lessons.length * 3), 
                className: 'empty-cell' 
              }, 'Henüz öğrenci kaydı bulunmamaktadır')
            ) :
            studentsList.map(student =>
              React.createElement('tr', { key: student.id },
                React.createElement('td', { className: 'student-name' }, student.full_name),
                React.createElement('td', { className: 'student-number' }, student.student_number || '-'),
                lessons.map(lesson => {
                  const grade = student.grades[lesson.id]
                  
                  return React.createElement(React.Fragment, { key: lesson.id },
                    React.createElement('td', { className: 'grade-cell' }, 
                      grade?.vize_score !== null && grade?.vize_score !== undefined 
                        ? grade.vize_score.toFixed(0) 
                        : '-'
                    ),
                    React.createElement('td', { className: 'grade-cell' }, 
                      grade?.final_score !== null && grade?.final_score !== undefined 
                        ? grade.final_score.toFixed(0) 
                        : '-'
                    ),
                    React.createElement('td', { className: 'grade-cell total-grade' }, 
                      grade?.total_score !== null && grade?.total_score !== undefined 
                        ? grade.total_score.toFixed(2) 
                        : '-'
                    )
                  )
                })
              )
            )
        )
      )
    )
  )
}

export default TeacherGrades

