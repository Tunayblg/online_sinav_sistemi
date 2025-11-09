import React, { useState, useEffect } from 'react'
import './Lessons.css'
import * as XLSX from 'xlsx'

function Lessons() {
  const [lessons, setLessons] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [uploadResults, setUploadResults] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    teacher_id: '',
    student_ids: []
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchLessons()
    fetchStudents()
    fetchTeachers()
  }, [])

  const fetchLessons = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('http://localhost:5000/api/admin/lessons', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        setLessons(data.lessons || [])
      }
      setLoading(false)
    } catch (err) {
      setError('Dersler yüklenirken hata oluştu')
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('http://localhost:5000/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        const studentList = data.users.filter(u => u.role_name === 'student')
        setStudents(studentList)
      }
    } catch (err) {
      console.error('Öğrenciler yüklenirken hata:', err)
    }
  }

  const fetchTeachers = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('http://localhost:5000/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        const teacherList = data.users.filter(u => u.role_name === 'teacher')
        setTeachers(teacherList)
      }
    } catch (err) {
      console.error('Öğretmenler yüklenirken hata:', err)
    }
  }

  const handleAddNewClick = () => {
    setIsAddingNew(true)
    setSelectedLesson(null)
    setFormData({ name: '', code: '', teacher_id: '', student_ids: [] })
    setError('')
    setSuccess('')
  }

  const handleLessonClick = (lesson) => {
    setIsAddingNew(false)
    setSelectedLesson(lesson)
    setSelectedDepartment('all')
    setFormData({
      name: lesson.name,
      code: lesson.code,
      teacher_id: lesson.teacher ? lesson.teacher.id : '',
      student_ids: lesson.students ? lesson.students.map(s => s.id) : []
    })
    setError('')
    setSuccess('')
  }

  const getFilteredStudents = () => {
    if (selectedDepartment === 'all') {
      return students
    }
    return students.filter(s => s.department === selectedDepartment)
  }

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleStudentToggle = (studentId) => {
    const currentIds = formData.student_ids || []
    if (currentIds.includes(studentId)) {
      setFormData({ ...formData, student_ids: currentIds.filter(id => id !== studentId) })
    } else {
      setFormData({ ...formData, student_ids: [...currentIds, studentId] })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('access_token')
      let response

      if (isAddingNew) {
        // Yeni ders ekle
        const requestBody = {
          name: formData.name,
          code: formData.code
        }
        console.log('DERS EKLEME İSTEĞİ:', requestBody)
        
        response = await fetch('http://localhost:5000/api/admin/lessons', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody)
        })
      } else if (selectedLesson) {
        // Mevcut dersi güncelle
        response = await fetch(`http://localhost:5000/api/admin/lessons/${selectedLesson.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
      }

      const data = await response.json()
      console.log('BACKEND CEVABI:', response.status, data)

      if (response.ok) {
        setSuccess(isAddingNew ? 'Ders başarıyla eklendi!' : 'Ders başarıyla güncellendi!')
        fetchLessons()
        if (isAddingNew) {
          setFormData({ name: '', code: '', teacher_id: '', student_ids: [] })
          setIsAddingNew(false)
        }
      } else {
        setError(data.error || 'İşlem başarısız')
      }
    } catch (err) {
      setError('İşlem sırasında hata oluştu')
    }
  }

  const handleDelete = async (lessonId, e) => {
    e.stopPropagation()
    if (!window.confirm('Bu dersi silmek istediğinizden emin misiniz?')) return

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`http://localhost:5000/api/admin/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        setSuccess('Ders silindi!')
        fetchLessons()
        if (selectedLesson && selectedLesson.id === lessonId) {
          setSelectedLesson(null)
          setIsAddingNew(false)
        }
      } else {
        setError('Ders silinirken hata oluştu')
      }
    } catch (err) {
      setError('Ders silinirken hata oluştu')
    }
  }

  const handleExcelUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        // İlk satır başlık, 2. satırdan itibaren veri
        const lessons = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row[0]) continue // Boş satırları atla

          lessons.push({
            name: String(row[0] || '').trim(),
            code: String(row[1] || '').trim()
          })
        }

        if (lessons.length === 0) {
          setError('Excel dosyasında ders verisi bulunamadı')
          return
        }

        // Backend'e gönder
        const token = localStorage.getItem('access_token')
        const response = await fetch('http://localhost:5000/api/admin/lessons/bulk-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ lessons })
        })

        const result = await response.json()

        if (response.ok) {
          setUploadResults(result)
          setSuccess(`Toplu yükleme tamamlandı! Oluşturulan: ${result.summary.created_count}, Güncellenen: ${result.summary.updated_count}, Hata: ${result.summary.error_count}`)
          fetchLessons()
        } else {
          setError(result.error || 'Toplu yükleme başarısız')
        }
      } catch (err) {
        console.error('Excel okuma hatası:', err)
        setError('Excel dosyası okunurken hata oluştu')
      }
    }

    reader.readAsArrayBuffer(file)
    // Input'u temizle
    event.target.value = ''
  }

  return React.createElement('div', { className: 'lessons-container' },
    // Sol taraf - Ders listesi
    React.createElement('div', { className: 'lessons-sidebar' },
      React.createElement('button', {
        className: 'add-lesson-btn',
        onClick: handleAddNewClick
      }, '+ Ders Ekle'),

      // Excel yükleme butonu
      React.createElement('div', { className: 'excel-upload-section' },
        React.createElement('input', {
          type: 'file',
          id: 'lesson-excel-upload',
          accept: '.xlsx, .xls',
          style: { display: 'none' },
          onChange: handleExcelUpload
        }),
        React.createElement('label', {
          htmlFor: 'lesson-excel-upload',
          className: 'excel-upload-btn'
        }, 'Excelden Yükle')
      ),

      React.createElement('h3', { className: 'sidebar-title' }, 'Mevcut Dersler'),

      loading && React.createElement('p', { className: 'loading-text' }, 'Yükleniyor...'),

      !loading && lessons.length === 0 && React.createElement('p', { className: 'empty-text' }, 'Henüz ders yok'),

      !loading && lessons.length > 0 && React.createElement('div', { className: 'lesson-list' },
        lessons.map(lesson =>
          React.createElement('div', {
            key: lesson.id,
            className: `lesson-list-item ${selectedLesson && selectedLesson.id === lesson.id ? 'selected' : ''}`,
            onClick: () => handleLessonClick(lesson)
          },
            React.createElement('div', { className: 'lesson-list-info' },
              React.createElement('div', { className: 'lesson-name' }, lesson.name),
              React.createElement('div', { className: 'lesson-code' }, lesson.code),
              React.createElement('div', { 
                className: lesson.teacher ? 'lesson-teacher assigned' : 'lesson-teacher unassigned'
              }, lesson.teacher ? lesson.teacher.full_name : 'Eğitim Görevlisi Atanmamış')
            ),
            React.createElement('button', {
              className: 'delete-icon-btn',
              onClick: (e) => handleDelete(lesson.id, e)
            }, '×')
          )
        )
      )
    ),

    // Sağ taraf - Form
    React.createElement('div', { className: 'lesson-form-area' },
      (isAddingNew || selectedLesson) && React.createElement('div', { className: 'lesson-form-box' },
        React.createElement('h2', { className: 'form-title' },
          isAddingNew ? 'Yeni Ders Ekle' : 'Ders Düzenle'
        ),

        error && React.createElement('div', { className: 'error-message' }, error),
        success && React.createElement('div', { className: 'success-message' }, success),

        uploadResults && React.createElement('div', { className: 'upload-results-box' },
          React.createElement('div', { className: 'upload-results-header' },
            React.createElement('h3', null, 'Excel Yükleme Sonuçları'),
            React.createElement('button', {
              className: 'close-results-btn',
              onClick: () => setUploadResults(null)
            }, '×')
          ),
          React.createElement('div', { className: 'upload-summary' },
            React.createElement('p', null, `Oluşturulan: ${uploadResults.summary.created_count}`),
            React.createElement('p', null, `Güncellenen: ${uploadResults.summary.updated_count}`),
            React.createElement('p', null, `Hata: ${uploadResults.summary.error_count}`)
          ),
          uploadResults.results.created.length > 0 && React.createElement('details', { className: 'upload-details' },
            React.createElement('summary', null, `Oluşturulan Dersler (${uploadResults.results.created.length})`),
            React.createElement('div', { className: 'upload-items' },
              uploadResults.results.created.map((item, idx) =>
                React.createElement('div', { key: idx, className: 'upload-item' },
                  React.createElement('p', null, `${item.code} - ${item.name}`)
                )
              )
            )
          ),
          uploadResults.results.errors.length > 0 && React.createElement('details', { className: 'upload-details error-details' },
            React.createElement('summary', null, `Hatalar (${uploadResults.results.errors.length})`),
            React.createElement('div', { className: 'upload-items' },
              uploadResults.results.errors.map((item, idx) =>
                React.createElement('div', { key: idx, className: 'upload-item error-item' },
                  React.createElement('p', null, `Satır ${item.row}: ${item.error}`)
                )
              )
            )
          )
        ),

        React.createElement('form', { onSubmit: handleSubmit, className: 'lesson-form' },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Ders Adı'),
            React.createElement('input', {
              type: 'text',
              value: formData.name,
              onChange: (e) => handleInputChange('name', e.target.value),
              required: true,
              placeholder: 'Örn: Veri Yapıları'
            })
          ),

          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Ders Kodu'),
            React.createElement('input', {
              type: 'text',
              value: formData.code,
              onChange: (e) => handleInputChange('code', e.target.value),
              required: true,
              placeholder: 'Örn: CS101'
            })
          ),

          !isAddingNew && React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Öğretmen'),
            React.createElement('select', {
              value: formData.teacher_id,
              onChange: (e) => handleInputChange('teacher_id', Number(e.target.value))
            },
              React.createElement('option', { value: '' }, 'Öğretmen Seçin'),
              teachers.map(teacher =>
                React.createElement('option', { key: teacher.id, value: teacher.id },
                  teacher.full_name
                )
              )
            )
          ),

          !isAddingNew && React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Öğrenciler'),
            React.createElement('div', { className: 'department-filter-wrapper' },
              React.createElement('select', {
                value: selectedDepartment,
                onChange: (e) => setSelectedDepartment(e.target.value)
              },
                React.createElement('option', { value: 'all' }, 'Tüm Bölümler'),
                React.createElement('option', { value: 'Bilgisayar Mühendisliği' }, 'Bilgisayar Mühendisliği'),
                React.createElement('option', { value: 'Yazılım Mühendisliği' }, 'Yazılım Mühendisliği'),
                React.createElement('option', { value: 'Psikoloji' }, 'Psikoloji'),
                React.createElement('option', { value: 'Diş Hekimliği' }, 'Diş Hekimliği'),
                React.createElement('option', { value: 'Eczacılık' }, 'Eczacılık')
              )
            ),
            React.createElement('div', { className: 'students-list' },
              students.length === 0 && React.createElement('p', { className: 'empty-text' }, 'Henüz öğrenci yok'),
              getFilteredStudents().length === 0 && students.length > 0 && 
                React.createElement('p', { className: 'empty-text' }, 'Bu bölümde öğrenci yok'),
              getFilteredStudents().map(student =>
                React.createElement('label', {
                  key: student.id,
                  className: 'student-checkbox-label'
                },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: formData.student_ids.includes(student.id),
                    onChange: () => handleStudentToggle(student.id)
                  }),
                  React.createElement('span', null,
                    `${student.student_number || 'N/A'} - ${student.full_name}`
                  )
                )
              )
            )
          ),

          React.createElement('button', {
            type: 'submit',
            className: 'submit-btn'
          }, isAddingNew ? 'Ders Ekle' : 'Değişiklikleri Kaydet')
        )
      ),

      !isAddingNew && !selectedLesson && React.createElement('div', { className: 'empty-state' },
        React.createElement('p', null, 'Bir ders seçin veya yeni ders ekleyin')
      )
    )
  )
}

export default Lessons
