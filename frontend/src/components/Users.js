import React, { useState, useEffect } from 'react'
import './Users.css'
import * as XLSX from 'xlsx'

function Users() {
  const [activeRole, setActiveRole] = useState('student')
  const [users, setUsers] = useState([])
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [uploadResults, setUploadResults] = useState(null)
  const [formData, setFormData] = useState({
    full_name: '',
    student_number: '',
    department: '',
    lesson_ids: []
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [generatedCredentials, setGeneratedCredentials] = useState(null)
  const [resetPasswordInfo, setResetPasswordInfo] = useState(null)

  useEffect(() => {
    fetchUsers()
    fetchLessons()
  }, [activeRole])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('http://localhost:5000/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        const roleMap = {
          'student': 'student',
          'teacher': 'teacher',
          'department_head': 'department_head'
        }
        const filteredUsers = data.users.filter(u => u.role_name === roleMap[activeRole])
        setUsers(filteredUsers)
      }
      setLoading(false)
    } catch (err) {
      setError('Kullanıcılar yüklenirken hata oluştu')
      setLoading(false)
    }
  }

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
    } catch (err) {
      console.error('Dersler yüklenirken hata:', err)
    }
  }

  const handleRoleChange = (role) => {
    setActiveRole(role)
    setSelectedUser(null)
    setIsAddingNew(false)
    setDepartmentFilter('all')
    setGeneratedCredentials(null)
  }

  const getFilteredUsers = () => {
    if (activeRole !== 'student' || departmentFilter === 'all') {
      return users
    }
    return users.filter(u => u.department === departmentFilter)
  }

  const handleAddNewClick = () => {
    setIsAddingNew(true)
    setSelectedUser(null)
    setFormData({ full_name: '', student_number: '', department: '', lesson_ids: [] })
    setError('')
    setSuccess('')
    setGeneratedCredentials(null)
    setResetPasswordInfo(null)
  }

  const handleResetPassword = async () => {
    if (!selectedUser) return
    if (!window.confirm('Bu kullanıcının şifresini sıfırlamak istediğinizden emin misiniz?')) return

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`http://localhost:5000/api/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Şifre başarıyla sıfırlandı!')
        setResetPasswordInfo({
          email: selectedUser.email,
          password: data.new_password
        })
      } else {
        setError(data.error || 'Şifre sıfırlanırken hata oluştu')
      }
    } catch (err) {
      setError('Şifre sıfırlanırken hata oluştu')
    }
  }

  const handleUserClick = async (user) => {
    setIsAddingNew(false)
    setSelectedUser(user)
    
    // Öğretim üyesi veya öğrenci ise derslerini yükle
    let userLessonIds = []
    if (user.role_name === 'teacher' || user.role_name === 'student') {
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`http://localhost:5000/api/admin/users/${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await response.json()
        if (response.ok) {
          if (user.role_name === 'teacher' && data.user.taught_lessons) {
            userLessonIds = data.user.taught_lessons.map(l => l.lesson_id)
          } else if (user.role_name === 'student' && data.user.enrolled_lessons) {
            userLessonIds = data.user.enrolled_lessons.map(l => l.lesson_id)
          }
        }
      } catch (err) {
        console.error('Ders bilgileri yüklenirken hata:', err)
      }
    }
    
    setFormData({
      full_name: user.full_name,
      student_number: user.student_number || '',
      department: user.department || '',
      lesson_ids: userLessonIds
    })
    setError('')
    setSuccess('')
    setGeneratedCredentials(null)
    setResetPasswordInfo(null)
  }

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleLessonToggle = (lessonId) => {
    const currentIds = formData.lesson_ids || []
    if (currentIds.includes(lessonId)) {
      setFormData({ ...formData, lesson_ids: currentIds.filter(id => id !== lessonId) })
    } else {
      setFormData({ ...formData, lesson_ids: [...currentIds, lessonId] })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setGeneratedCredentials(null)

    try {
      const token = localStorage.getItem('access_token')
      const roleMap = {
        'student': 'student',
        'teacher': 'teacher',
        'department_head': 'department_head'
      }

      const requestBody = {
        full_name: formData.full_name,
        role: roleMap[activeRole]
      }

      if (activeRole === 'student') {
        requestBody.student_number = formData.student_number
        requestBody.department = formData.department
      }

      if ((activeRole === 'teacher' || activeRole === 'student') && !isAddingNew) {
        requestBody.lesson_ids = formData.lesson_ids
      }

      let response
      if (isAddingNew) {
        response = await fetch('http://localhost:5000/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody)
        })
      } else if (selectedUser) {
        response = await fetch(`http://localhost:5000/api/admin/users/${selectedUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody)
        })
      }

      const data = await response.json()

      if (response.ok) {
        setSuccess(isAddingNew ? 'Kullanıcı başarıyla eklendi!' : 'Kullanıcı başarıyla güncellendi!')
        
        if (isAddingNew && data.credentials) {
          setGeneratedCredentials(data.credentials)
        }
        
        fetchUsers()
        if (isAddingNew) {
          setFormData({ full_name: '', student_number: '', department: '', lesson_ids: [] })
        }
      } else {
        setError(data.error || 'İşlem başarısız')
      }
    } catch (err) {
      setError('İşlem sırasında hata oluştu')
    }
  }

  const handleDelete = async (userId, e) => {
    e.stopPropagation()
    if (!window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        setSuccess('Kullanıcı silindi!')
        fetchUsers()
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser(null)
          setIsAddingNew(false)
        }
      } else {
        setError('Kullanıcı silinirken hata oluştu')
      }
    } catch (err) {
      setError('Kullanıcı silinirken hata oluştu')
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
        const students = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row[0]) continue // Boş satırları atla

          students.push({
            student_number: String(row[0] || '').trim(),
            first_name: String(row[1] || '').trim(),
            last_name: String(row[2] || '').trim(),
            department: String(row[3] || '').trim()
          })
        }

        if (students.length === 0) {
          setError('Excel dosyasında öğrenci verisi bulunamadı')
          return
        }

        // Backend'e gönder
        const token = localStorage.getItem('access_token')
        const response = await fetch('http://localhost:5000/api/admin/users/bulk-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ students })
        })

        const result = await response.json()

        if (response.ok) {
          setUploadResults(result)
          setSuccess(`Toplu yükleme tamamlandı! Oluşturulan: ${result.summary.created_count}, Güncellenen: ${result.summary.updated_count}, Hata: ${result.summary.error_count}`)
          fetchUsers()
        } else {
          setError(result.error || 'Toplu yükleme başarısız')
        }
      } catch (err) {
        console.error('Excel okuma hatası:', err)
        setError('Excel dosyası okunurken hata oluştu')
      }
    }

    reader.readAsArrayBuffer(file)
    // Input'u temizle (aynı dosyayı tekrar seçebilmek için)
    event.target.value = ''
  }

  const getRoleLabel = (role) => {
    const labels = {
      'student': 'Öğrenci',
      'teacher': 'Öğretim Üyesi',
      'department_head': 'Bölüm Başkanı'
    }
    return labels[role] || role
  }

  return React.createElement('div', { className: 'users-container' },
    // Sol sidebar
    React.createElement('div', { className: 'users-sidebar' },
      // Role tabs
      React.createElement('div', { className: 'role-tabs' },
        React.createElement('button', {
          className: `role-tab ${activeRole === 'student' ? 'active' : ''}`,
          onClick: () => handleRoleChange('student')
        }, 'Öğrenci'),
        React.createElement('button', {
          className: `role-tab ${activeRole === 'teacher' ? 'active' : ''}`,
          onClick: () => handleRoleChange('teacher')
        }, 'Öğretim Üyesi'),
        React.createElement('button', {
          className: `role-tab ${activeRole === 'department_head' ? 'active' : ''}`,
          onClick: () => handleRoleChange('department_head')
        }, 'Bölüm Başkanı')
      ),

      React.createElement('button', {
        className: 'add-user-btn',
        onClick: handleAddNewClick
      }, '+ Kullanıcı Ekle'),

      // Excel yükleme butonu (sadece öğrenciler için)
      activeRole === 'student' && React.createElement('div', { className: 'excel-upload-section' },
        React.createElement('input', {
          type: 'file',
          id: 'excel-upload',
          accept: '.xlsx, .xls',
          style: { display: 'none' },
          onChange: handleExcelUpload
        }),
        React.createElement('label', {
          htmlFor: 'excel-upload',
          className: 'excel-upload-btn'
        }, 'Excelden Yükle')
      ),

      // Bölüm filtresi (sadece öğrenciler için)
      activeRole === 'student' && React.createElement('div', { className: 'department-filter' },
        React.createElement('select', {
          value: departmentFilter,
          onChange: (e) => setDepartmentFilter(e.target.value),
          className: 'department-filter-select'
        },
          React.createElement('option', { value: 'all' }, 'Tümünü Gör'),
          React.createElement('option', { value: 'Bilgisayar Mühendisliği' }, 'Bilgisayar Mühendisliği'),
          React.createElement('option', { value: 'Yazılım Mühendisliği' }, 'Yazılım Mühendisliği'),
          React.createElement('option', { value: 'Psikoloji' }, 'Psikoloji'),
          React.createElement('option', { value: 'Diş Hekimliği' }, 'Diş Hekimliği'),
          React.createElement('option', { value: 'Eczacılık' }, 'Eczacılık')
        )
      ),

      React.createElement('h3', { className: 'sidebar-title' }, `${getRoleLabel(activeRole)} Listesi`),

      loading && React.createElement('p', { className: 'loading-text' }, 'Yükleniyor...'),

      !loading && users.length === 0 && React.createElement('p', { className: 'empty-text' }, 'Henüz kullanıcı yok'),

      !loading && getFilteredUsers().length === 0 && users.length > 0 && 
        React.createElement('p', { className: 'empty-text' }, 'Bu bölümde öğrenci yok'),

      !loading && getFilteredUsers().length > 0 && React.createElement('div', { className: 'user-list' },
        getFilteredUsers().map(user =>
          React.createElement('div', {
            key: user.id,
            className: `user-list-item ${selectedUser && selectedUser.id === user.id ? 'selected' : ''}`,
            onClick: () => handleUserClick(user)
          },
            React.createElement('div', { className: 'user-list-info' },
              React.createElement('div', { className: 'user-name' }, user.full_name),
              React.createElement('div', { className: 'user-email' }, user.email),
              activeRole === 'student' && user.student_number && 
                React.createElement('div', { className: 'user-number' }, `No: ${user.student_number}`)
            ),
            React.createElement('button', {
              className: 'delete-icon-btn',
              onClick: (e) => handleDelete(user.id, e)
            }, '×')
          )
        )
      )
    ),

    // Sağ taraf - Form
    React.createElement('div', { className: 'user-form-area' },
      (isAddingNew || selectedUser) && React.createElement('div', { className: 'user-form-box' },
        React.createElement('h2', { className: 'form-title' },
          isAddingNew ? `Yeni ${getRoleLabel(activeRole)} Ekle` : `${getRoleLabel(activeRole)} Düzenle`
        ),

        error && React.createElement('div', { className: 'error-message' }, error),
        success && React.createElement('div', { className: 'success-message' }, success),

        generatedCredentials && React.createElement('div', { className: 'credentials-box' },
          React.createElement('h3', null, 'Oluşturulan Giriş Bilgileri:'),
          React.createElement('p', null, `Email: ${generatedCredentials.email}`),
          React.createElement('p', null, `Şifre: ${generatedCredentials.password}`),
          React.createElement('small', null, 'Bu bilgileri kullanıcıya iletin!')
        ),

        resetPasswordInfo && React.createElement('div', { className: 'credentials-box' },
          React.createElement('h3', null, 'Yeni Şifre:'),
          React.createElement('p', null, `Email: ${resetPasswordInfo.email}`),
          React.createElement('p', null, `Yeni Şifre: ${resetPasswordInfo.password}`),
          React.createElement('small', null, 'Bu bilgileri kullanıcıya iletin!')
        ),

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
            React.createElement('summary', null, `Oluşturulan Öğrenciler (${uploadResults.results.created.length})`),
            React.createElement('div', { className: 'upload-items' },
              uploadResults.results.created.map((item, idx) =>
                React.createElement('div', { key: idx, className: 'upload-item' },
                  React.createElement('p', null, `${item.student_number} - ${item.full_name}`),
                  React.createElement('small', null, `Email: ${item.email} | Şifre: ${item.password}`)
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

        React.createElement('form', { onSubmit: handleSubmit, className: 'user-form' },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Ad Soyad'),
            React.createElement('input', {
              type: 'text',
              value: formData.full_name,
              onChange: (e) => handleInputChange('full_name', e.target.value),
              required: true,
              placeholder: 'Örn: Tunay Bilgi'
            })
          ),

          activeRole === 'student' && React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Öğrenci Numarası'),
            React.createElement('input', {
              type: 'text',
              value: formData.student_number,
              onChange: (e) => handleInputChange('student_number', e.target.value),
              required: true,
              placeholder: 'Örn: 220502031'
            })
          ),

          activeRole === 'student' && React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Bölüm'),
            React.createElement('select', {
              value: formData.department,
              onChange: (e) => handleInputChange('department', e.target.value),
              required: true
            },
              React.createElement('option', { value: '' }, 'Bölüm Seçin'),
              React.createElement('option', { value: 'Bilgisayar Mühendisliği' }, 'Bilgisayar Mühendisliği'),
              React.createElement('option', { value: 'Yazılım Mühendisliği' }, 'Yazılım Mühendisliği'),
              React.createElement('option', { value: 'Psikoloji' }, 'Psikoloji'),
              React.createElement('option', { value: 'Diş Hekimliği' }, 'Diş Hekimliği'),
              React.createElement('option', { value: 'Eczacılık' }, 'Eczacılık')
            )
          ),

          (activeRole === 'teacher' || activeRole === 'student') && !isAddingNew && React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, activeRole === 'teacher' ? 'Verdiği Dersler' : 'Aldığı Dersler'),
            React.createElement('div', { className: 'lessons-list' },
              lessons.length === 0 && React.createElement('p', { className: 'empty-text' }, 'Henüz ders yok'),
              lessons.map(lesson =>
                React.createElement('label', {
                  key: lesson.id,
                  className: 'lesson-checkbox-label'
                },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: formData.lesson_ids.includes(lesson.id),
                    onChange: () => handleLessonToggle(lesson.id)
                  }),
                  React.createElement('span', null, `${lesson.code} - ${lesson.name}`)
                )
              )
            )
          ),

          (activeRole === 'teacher' || activeRole === 'department_head') && !isAddingNew && 
            React.createElement('button', {
              type: 'button',
              className: 'reset-password-btn',
              onClick: handleResetPassword
            }, 'Şifreyi Sıfırla'),

          React.createElement('button', {
            type: 'submit',
            className: 'submit-btn'
          }, isAddingNew ? 'Kullanıcı Ekle' : 'Değişiklikleri Kaydet')
        )
      ),

      !isAddingNew && !selectedUser && React.createElement('div', { className: 'empty-state' },
        React.createElement('p', null, 'Bir kullanıcı seçin veya yeni kullanıcı ekleyin')
      )
    )
  )
}

export default Users

