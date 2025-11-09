import React, { useState, useEffect } from 'react'
import './TeacherExams.css'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'

function TeacherExams() {
  const [lessons, setLessons] = useState([])
  const [tests, setTests] = useState([])
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [excelFile, setExcelFile] = useState(null)
  const [uploadModalTest, setUploadModalTest] = useState(null)
  const [viewQuestionsModal, setViewQuestionsModal] = useState(false)
  const [currentQuestions, setCurrentQuestions] = useState([])
  const [testForm, setTestForm] = useState({
    test_type: 'vize',
    start_time: '',
    end_time: '',
    duration: '',
    question_count: ''
  })

  useEffect(() => {
    fetchLessons()
  }, [])

  useEffect(() => {
    if (lessons.length > 0) {
      fetchAllTests()
    }
  }, [lessons])

  useEffect(() => {
    // Kalan süre için her dakika güncelle
    const interval = setInterval(() => {
      fetchAllTests()
    }, 60000) // 60 saniye
    return () => clearInterval(interval)
  }, [lessons])

  const fetchLessons = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/teacher/lessons`, {
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

  const fetchAllTests = async () => {
    try {
      const token = localStorage.getItem('access_token')
      // Tüm dersler için testleri topla
      const allTests = []
      for (const lesson of lessons) {
        const response = await fetch(`${API_BASE_URL}/teacher/lessons/${lesson.id}/tests`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await response.json()
        if (response.ok && data.tests) {
          data.tests.forEach(test => {
            test.lesson_name = lesson.name
            allTests.push(test)
          })
        }
      }
      setTests(allTests)
    } catch (err) {
      console.error('Sınavlar yüklenirken hata:', err)
    }
  }

  const handleLessonSelect = (lesson) => {
    setSelectedLesson(lesson)
    setError('')
    setSuccess('')
    // Formu sıfırla
    setTestForm({
      test_type: 'vize',
      start_time: '',
      end_time: '',
      duration: '',
      question_count: ''
    })
  }

  const handleFormChange = (field, value) => {
    setTestForm({ ...testForm, [field]: value })
  }

  const handleCreateTest = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validasyon
    if (!testForm.start_time || !testForm.end_time || !testForm.duration || !testForm.question_count) {
      setError('Lütfen tüm alanları doldurun')
      return
    }

    if (parseInt(testForm.question_count) < 1) {
      setError('Soru sayısı en az 1 olmalıdır')
      return
    }

    if (parseInt(testForm.duration) < 1) {
      setError('Süre en az 1 dakika olmalıdır')
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/teacher/tests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lesson_id: selectedLesson.id,
          test_type: testForm.test_type,
          start_time: testForm.start_time,
          end_time: testForm.end_time,
          duration: parseInt(testForm.duration),
          min_questions: parseInt(testForm.question_count),
          vize_weight: selectedLesson.vize_weight || 40,
          final_weight: selectedLesson.final_weight || 60
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Sınav başarıyla oluşturuldu!')
        // Formu sıfırlama
        setTestForm({
          test_type: 'vize',
          start_time: '',
          end_time: '',
          duration: '',
          question_count: ''
        })
        // Sınav listesini güncelle
        fetchAllTests()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Sınav oluşturulurken hata oluştu')
      }
    } catch (err) {
      console.error('Sınav oluşturma hatası:', err)
      setError('Sınav oluşturulurken hata oluştu')
    }
  }

  const handleExcelChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setExcelFile(file)
    }
  }

  const handleOpenUploadModal = (test) => {
    setUploadModalTest(test)
    setExcelFile(null)
    setError('')
    setSuccess('')
  }

  const handleViewQuestions = async (testId) => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/teacher/tests/${testId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      
      if (response.ok) {
        setCurrentQuestions(data.questions || [])
        setViewQuestionsModal(true)
      } else {
        setError(data.error || 'Sorular yüklenirken hata oluştu')
      }
    } catch (err) {
      console.error('Sorular yüklenirken hata:', err)
      setError('Sorular yüklenirken hata oluştu')
    }
  }

  const handleDeleteQuestions = async (testId) => {
    if (!window.confirm('Bu sınavın TÜM SORULARINI silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/teacher/tests/${testId}/questions`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        setSuccess('Tüm sorular başarıyla silindi!')
        fetchAllTests()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Sorular silinirken hata oluştu')
      }
    } catch (err) {
      console.error('Sorular silme hatası:', err)
      setError('Sorular silinirken hata oluştu')
    }
  }

  const handleDeleteTest = async (testId) => {
    if (!window.confirm('Bu sınavı silmek istediğinizden emin misiniz? Tüm sorular ve öğrenci cevapları silinecektir!')) {
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/teacher/tests/${testId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        setSuccess('Sınav başarıyla silindi!')
        fetchAllTests()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Sınav silinirken hata oluştu')
      }
    } catch (err) {
      console.error('Sınav silme hatası:', err)
      setError('Sınav silinirken hata oluştu')
    }
  }

  const handleUploadQuestions = async () => {
    if (!excelFile || !uploadModalTest) {
      setError('Lütfen Excel dosyası seçin')
      return
    }

    setError('')
    setSuccess('Dosya okunuyor...')

    try {
      // xlsx kütüphanesini import et
      const XLSX = await import('xlsx')
      
      // Excel dosyasını oku
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          
          // İlk sheet'i al
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          
          // Sheet'i JSON'a çevir
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
          
          if (jsonData.length < 2) {
            setError('Excel dosyası boş veya yanlış formatta')
            setSuccess('')
            return
          }
          
          // İlk satır başlık, geri kalanı sorular
          const questions = []
          
          // Satır 2'den başla (satır 1 başlık)
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            
            // Boş satırları atla
            if (!row || row.length === 0 || !row[0]) {
              continue
            }
            
            // Format: SORU METNİ | A | B | C | D | E | BOŞ BIRAK | DOĞRU CEVAP
            // veya: SORU METNİ | A | B | C | D | DOĞRU CEVAP (basitleştirilmiş)
            const question_text = String(row[0] || '').trim()
            const option_a = String(row[1] || '').trim()
            const option_b = String(row[2] || '').trim()
            const option_c = String(row[3] || '').trim()
            const option_d = String(row[4] || '').trim()
            
            // Doğru cevap son sütunda veya 5. sütunda olabilir
            let correct_answer = ''
            if (row.length >= 8) {
              // Tam format: SORU | A | B | C | D | E | BOŞ BIRAK | DOĞRU CEVAP
              correct_answer = String(row[7] || '').trim().toLowerCase()
            } else if (row.length >= 6) {
              // Orta format: SORU | A | B | C | D | DOĞRU CEVAP
              correct_answer = String(row[5] || '').trim().toLowerCase()
            } else {
              // Kısa format: SORU | A | B | C | DOĞRU CEVAP
              correct_answer = String(row[4] || '').trim().toLowerCase()
            }
            
            // Doğru cevap A-E arasında olmalı, sadece ilk harfini al
            if (correct_answer) {
              correct_answer = correct_answer.charAt(0).toLowerCase()
            }
            
            // Validasyon
            if (!question_text) {
              console.warn(`Satır ${i + 1}: Soru metni boş, atlanıyor`)
              continue
            }
            
            if (!option_a || !option_b) {
              console.warn(`Satır ${i + 1}: A ve B şıkları zorunlu, atlanıyor`)
              continue
            }
            
            if (!correct_answer || !['a', 'b', 'c', 'd'].includes(correct_answer)) {
              console.warn(`Satır ${i + 1}: Geçersiz doğru cevap (${correct_answer}), atlanıyor`)
              continue
            }
            
            questions.push({
              question_text,
              option_a,
              option_b,
              option_c: option_c || '-',
              option_d: option_d || '-',
              correct_answer
              // points backend'de otomatik hesaplanacak
            })
          }
          
          if (questions.length === 0) {
            setError('Excel dosyasında geçerli soru bulunamadı')
            setSuccess('')
            return
          }
          
          setSuccess(`${questions.length} soru işleniyor...`)
          
          // Backend'e gönder
          const token = localStorage.getItem('access_token')
          const response = await fetch(`${API_BASE_URL}/teacher/tests/${uploadModalTest.id}/questions/bulk`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ questions })
          })
          
          const result = await response.json()
          
          if (response.ok) {
            const successMsg = `${result.summary.created_count} soru başarıyla eklendi. ` +
              `(Toplam: ${result.summary.total_questions}/${result.summary.required_questions})` +
              (result.summary.error_count > 0 ? ` • ${result.summary.error_count} satır hatalı` : '')
            setSuccess(successMsg)
            
            // Hata detaylarını göster
            if (result.results.errors && result.results.errors.length > 0) {
              console.error('Soru yükleme hataları:', result.results.errors)
            }
            
            // Modal'ı kapat ve listeyi yenile
            setTimeout(() => {
              setUploadModalTest(null)
              setExcelFile(null)
              fetchAllTests()
            }, 2000)
          } else {
            setError(result.error || 'Sorular yüklenirken hata oluştu')
            setSuccess('')
          }
          
        } catch (parseError) {
          console.error('Excel parse hatası:', parseError)
          setError(`Dosya işlenirken hata oluştu: ${parseError.message}`)
          setSuccess('')
        }
      }
      
      reader.onerror = (error) => {
        console.error('Dosya okuma hatası:', error)
        setError('Dosya okunamadı. Lütfen geçerli bir Excel dosyası seçin.')
        setSuccess('')
      }
      
      reader.readAsArrayBuffer(excelFile)
      
    } catch (error) {
      console.error('Excel yükleme hatası:', error)
      setError(`Hata: ${error.message}`)
      setSuccess('')
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

  const getTimeRemaining = (startTime, endTime) => {
    const now = new Date()
    const start = new Date(startTime)
    const end = new Date(endTime)

    if (now < start) {
      const diff = start - now
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      return { status: 'upcoming', text: `${hours}s ${minutes}dk sonra` }
    } else if (now >= start && now <= end) {
      const diff = end - now
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      if (hours > 0) {
        return { status: 'active', text: `${hours}s ${minutes}dk kaldı` }
      } else {
        return { status: 'active', text: `${minutes}dk kaldı` }
      }
    } else {
      return { status: 'ended', text: 'Bitti' }
    }
  }

  return React.createElement('div', { className: 'teacher-exams-container' },
    React.createElement('h2', { className: 'page-title' }, 'Sınav Yönetimi'),

    // Oluşturulan Sınavlar Listesi
    React.createElement('div', { className: 'tests-list-section' },
      React.createElement('h3', { className: 'section-title' }, 'Oluşturulan Sınavlar'),
      
      tests.length === 0 && !loading && React.createElement('p', { className: 'empty-text' },
        'Henüz sınav oluşturmadınız.'
      ),

      tests.length > 0 && React.createElement('div', { className: 'tests-table-wrapper' },
        React.createElement('table', { className: 'tests-table' },
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, 'Ders'),
              React.createElement('th', null, 'Sınav Türü'),
              React.createElement('th', null, 'Başlangıç Tarihi'),
              React.createElement('th', null, 'Bitiş Tarihi'),
              React.createElement('th', null, 'Süre'),
              React.createElement('th', null, 'Soru Sayısı'),
              React.createElement('th', null, 'İşlemler')
            )
          ),
          React.createElement('tbody', null,
            tests.map(test =>
              React.createElement('tr', { key: test.id },
                React.createElement('td', null, test.lesson_name || '-'),
                React.createElement('td', null,
                  React.createElement('span', { className: `test-type-badge ${test.test_type}` },
                    test.test_type === 'vize' ? 'Vize' : 'Final'
                  )
                ),
                React.createElement('td', null,
                  React.createElement('div', null,
                    React.createElement('div', null, formatDate(test.start_time)),
                    React.createElement('span', { 
                      className: `time-remaining-badge ${getTimeRemaining(test.start_time, test.end_time).status}`
                    }, getTimeRemaining(test.start_time, test.end_time).text)
                  )
                ),
                React.createElement('td', null, formatDate(test.end_time)),
                React.createElement('td', null, `${Math.floor(test.duration / 60)} dk`),
                React.createElement('td', null,
                  React.createElement('div', { className: 'question-info' },
                    React.createElement('span', { 
                      className: 'question-count-badge',
                      title: `Sınavda ${test.min_questions} soru gösterilecek`
                    }, `${test.min_questions} soru`),
                    React.createElement('span', { className: 'uploaded-count' }, 
                      `${test.question_count || 0} yüklendi`
                    )
                  )
                ),
                React.createElement('td', { className: 'actions-cell' },
                  React.createElement('div', { className: 'actions-layout' },
                    React.createElement('button', {
                      className: 'action-btn upload-btn-large',
                      onClick: () => handleOpenUploadModal(test)
                    }, 'Soru Yükle'),
                    React.createElement('div', { className: 'actions-row' },
                      React.createElement('button', {
                        className: 'action-btn view-btn',
                        onClick: () => handleViewQuestions(test.id)
                      }, 'Soruları Gör'),
                      React.createElement('button', {
                        className: 'action-btn delete-questions-btn',
                        onClick: () => handleDeleteQuestions(test.id)
                      }, 'Soruları Sil'),
                      React.createElement('button', {
                        className: 'action-btn delete-test-btn',
                        onClick: () => handleDeleteTest(test.id)
                      }, 'Sınavı Sil')
                    )
                  )
                )
              )
            )
          )
        )
      )
    ),

    React.createElement('div', { className: 'divider' }),

    React.createElement('h3', { className: 'section-title' }, 'Yeni Sınav Oluştur'),

    // Dersler listesi
    React.createElement('div', { className: 'lessons-section' },
      React.createElement('h3', { className: 'section-title' }, 'Dersleriniz'),
      
      loading && React.createElement('p', { className: 'loading-text' }, 'Yükleniyor...'),

      !loading && lessons.length === 0 && React.createElement('p', { className: 'empty-text' },
        'Henüz ders kaydınız bulunmamaktadır.'
      ),

      !loading && lessons.length > 0 && React.createElement('div', { className: 'lessons-grid' },
        lessons.map(lesson =>
          React.createElement('div', {
            key: lesson.id,
            className: `lesson-card ${selectedLesson && selectedLesson.id === lesson.id ? 'selected' : ''}`,
            onClick: () => handleLessonSelect(lesson)
          },
            React.createElement('div', { className: 'lesson-card-title' }, lesson.name),
            React.createElement('div', { className: 'lesson-card-code' }, lesson.code)
          )
        )
      )
    ),

    // Sınav oluşturma formu
    selectedLesson && React.createElement('div', { className: 'exam-form-section' },
      React.createElement('h3', { className: 'section-title' }, 
        `${selectedLesson.name} için Sınav Oluştur`
      ),

      error && React.createElement('div', { className: 'error-message' }, error),
      success && React.createElement('div', { className: 'success-message' }, success),

      React.createElement('form', { className: 'exam-form', onSubmit: handleCreateTest },
        // Sınav Türü
        React.createElement('div', { className: 'form-row' },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Sınav Türü'),
            React.createElement('select', {
              className: 'form-select',
              value: testForm.test_type,
              onChange: (e) => handleFormChange('test_type', e.target.value)
            },
              React.createElement('option', { value: 'vize' }, 'Vize'),
              React.createElement('option', { value: 'final' }, 'Final')
            )
          )
        ),

        // Başlangıç ve Bitiş Tarihi
        React.createElement('div', { className: 'form-row' },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Başlangıç Tarihi ve Saati'),
            React.createElement('input', {
              type: 'datetime-local',
              className: 'form-input',
              value: testForm.start_time,
              onChange: (e) => handleFormChange('start_time', e.target.value)
            })
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Bitiş Tarihi ve Saati'),
            React.createElement('input', {
              type: 'datetime-local',
              className: 'form-input',
              value: testForm.end_time,
              onChange: (e) => handleFormChange('end_time', e.target.value)
            })
          )
        ),

        // Süre ve Soru Sayısı
        React.createElement('div', { className: 'form-row' },
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Sınav Süresi (dakika)'),
            React.createElement('input', {
              type: 'number',
              className: 'form-input',
              value: testForm.duration,
              onChange: (e) => handleFormChange('duration', e.target.value),
              min: '1',
              placeholder: 'Örn: 60'
            })
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', null, 'Soru Sayısı'),
            React.createElement('input', {
              type: 'number',
              className: 'form-input',
              value: testForm.question_count,
              onChange: (e) => handleFormChange('question_count', e.target.value),
              min: '1',
              placeholder: 'Örn: 20'
            })
          )
        ),

        // Submit butonu
        React.createElement('button', {
          type: 'submit',
          className: 'create-exam-btn'
        }, 'Sınav Oluştur')
      )
    ),

    // Soru Yükleme Modal'ı
    uploadModalTest && React.createElement('div', { className: 'modal-overlay', onClick: () => setUploadModalTest(null) },
      React.createElement('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('h3', null, `${uploadModalTest.lesson_name || 'Sınav'} - Soru Yükle`),
          React.createElement('button', { className: 'modal-close', onClick: () => setUploadModalTest(null) }, '×')
        ),
        React.createElement('div', { className: 'modal-body' },
          React.createElement('div', { 
            className: 'question-pool-info',
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              marginBottom: '16px',
              backgroundColor: '#f8f9fa',
              borderLeft: `3px solid ${(uploadModalTest.question_count || 0) < uploadModalTest.min_questions ? '#dc3545' : '#28a745'}`,
              fontSize: '14px'
            }
          },
            React.createElement('div', { style: { display: 'flex', gap: '24px', alignItems: 'center' } },
              React.createElement('span', { style: { color: '#495057' } },
                `Havuzdaki Soru: `,
                React.createElement('strong', { style: { color: '#212529' } }, uploadModalTest.question_count || 0)
              ),
              React.createElement('span', { style: { color: '#495057' } },
                `Gerekli: `,
                React.createElement('strong', { style: { color: '#212529' } }, uploadModalTest.min_questions)
              )
            ),
            React.createElement('span', { 
              style: { 
                fontSize: '13px',
                color: (uploadModalTest.question_count || 0) < uploadModalTest.min_questions ? '#dc3545' : '#28a745',
                fontWeight: '500'
              }
            },
              (uploadModalTest.question_count || 0) < uploadModalTest.min_questions ? 
                `${uploadModalTest.min_questions - (uploadModalTest.question_count || 0)} soru eksik` :
                'Yeterli'
            )
          ),
          React.createElement('div', { className: 'upload-info-box' },
            React.createElement('h5', null, 'Nasıl Çalışır?'),
            React.createElement('ul', null,
              React.createElement('li', null, `Sınavda ${uploadModalTest.min_questions} soru gösterilecek`),
              React.createElement('li', null, 'Excel\'den daha fazla soru yükleyebilirsiniz (soru havuzu)'),
              React.createElement('li', null, 'Her öğrenci rastgele sorular görecek'),
              React.createElement('li', null, 'Her satır bir soru olarak kaydedilir')
            )
          ),
          React.createElement('div', { className: 'excel-format-info' },
            React.createElement('p', { className: 'format-title' }, 'Excel Formatı:'),
            React.createElement('div', { className: 'format-table' },
              React.createElement('p', { className: 'format-header' }, 
                'SORU METNİ | A ŞIKKI | B ŞIKKI | C ŞIKKI (ops.) | D ŞIKKI (ops.) | E ŞIKKI (ops.) | BOŞ BIRAK ŞIKKI (E/H) | DOĞRU CEVAP (A–E)'
              ),
              React.createElement('p', { className: 'format-example' }, 
                'Örnek: "2+2=?" | "3" | "4" | "5" | "6" | "7" | "E" | "B"'
              )
            ),
            React.createElement('div', { className: 'format-rules' },
              React.createElement('p', { className: 'rules-title' }, 'Kurallar:'),
              React.createElement('ul', { className: 'rules-list' },
                React.createElement('li', null, 'SORU METNİ, A ŞIKKI, B ŞIKKI, DOĞRU CEVAP zorunludur'),
                React.createElement('li', null, 'C, D, E şıkları isteğe bağlıdır (boş bırakılabilir)'),
                React.createElement('li', null, 'BOŞ BIRAK ŞIKKI: "E" veya "H" (boşsa "E" varsayılır)'),
                React.createElement('li', null, 'DOĞRU CEVAP: A, B, C, D veya E olabilir'),
                React.createElement('li', null, '"Boş bırak" doğru cevap olamaz')
              )
            )
          ),
          React.createElement('div', { className: 'file-upload-wrapper' },
            React.createElement('input', {
              type: 'file',
              accept: '.xlsx,.xls',
              onChange: handleExcelChange,
              className: 'file-input',
              id: 'modal-excel-file'
            }),
            React.createElement('label', { htmlFor: 'modal-excel-file', className: 'file-label' },
              excelFile ? excelFile.name : 'Excel Dosyası Seçin'
            )
          ),
          error && React.createElement('div', { className: 'error-message' }, error),
          excelFile && React.createElement('button', {
            className: 'upload-btn',
            onClick: handleUploadQuestions
          }, 'Soruları Yükle')
        )
      )
    ),

    // Soruları Görüntüleme Modal'ı
    viewQuestionsModal && React.createElement('div', { className: 'modal-overlay', onClick: () => setViewQuestionsModal(false) },
      React.createElement('div', { className: 'modal-content large', onClick: (e) => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('h3', null, `Sorular (${currentQuestions.length} adet)`),
          React.createElement('button', { className: 'modal-close', onClick: () => setViewQuestionsModal(false) }, '×')
        ),
        React.createElement('div', { className: 'modal-body' },
          currentQuestions.length === 0 ? 
            React.createElement('p', { className: 'empty-text' }, 'Henüz soru yüklenmemiş.') :
            React.createElement('div', { className: 'questions-list' },
              currentQuestions.map((question, index) =>
                React.createElement('div', { key: question.id, className: 'question-item' },
                  React.createElement('div', { className: 'question-header' },
                    React.createElement('span', { className: 'question-number' }, `Soru ${index + 1}`),
                    React.createElement('span', { className: 'question-points' }, `${question.points} puan`)
                  ),
                  React.createElement('div', { className: 'question-text' }, question.question_text),
                  React.createElement('div', { className: 'question-options' },
                    React.createElement('div', { className: `option ${question.correct_answer === 'a' ? 'correct' : ''}` },
                      React.createElement('span', { className: 'option-label' }, 'A)'),
                      React.createElement('span', null, question.option_a)
                    ),
                    React.createElement('div', { className: `option ${question.correct_answer === 'b' ? 'correct' : ''}` },
                      React.createElement('span', { className: 'option-label' }, 'B)'),
                      React.createElement('span', null, question.option_b)
                    ),
                    React.createElement('div', { className: `option ${question.correct_answer === 'c' ? 'correct' : ''}` },
                      React.createElement('span', { className: 'option-label' }, 'C)'),
                      React.createElement('span', null, question.option_c)
                    ),
                    React.createElement('div', { className: `option ${question.correct_answer === 'd' ? 'correct' : ''}` },
                      React.createElement('span', { className: 'option-label' }, 'D)'),
                      React.createElement('span', null, question.option_d)
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

export default TeacherExams

