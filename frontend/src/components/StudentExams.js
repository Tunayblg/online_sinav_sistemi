import React, { useState, useEffect, useCallback, useRef } from 'react'
import './StudentExams.css'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'

function StudentExams({ examMode = false, onEnterExam = null, onExitExam = null, initialExamData = null }) {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTest, setActiveTest] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [testStarted, setTestStarted] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0) // Aktif soru index'i
  const answersRef = useRef({})
  const activeTestRef = useRef(null)

  // initialExamData varsa (exam mode'a ilk girildiğinde), state'i set et
  useEffect(() => {
    if (initialExamData) {
      console.log('🎬 initialExamData yükleniyor:', initialExamData)
      setActiveTest(initialExamData.test)
      activeTestRef.current = initialExamData.test
      setQuestions(initialExamData.questions || [])
      setTimeRemaining(initialExamData.remaining_time_seconds)
      setTestStarted(true)
      setAnswers({})
      answersRef.current = {}
      setCurrentQuestionIndex(0)
    }
  }, [initialExamData])

  const fetchTests = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/student/tests/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        setTests(data.tests || [])
      } else {
        setError(data.error || 'Sınavlar yüklenirken hata oluştu')
      }
      setLoading(false)
    } catch (err) {
      console.error('Sınavlar yüklenirken hata:', err)
      setError('Sınavlar yüklenirken hata oluştu')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Exam mode'dayken sınav listesini getirme, sadece liste modunda getir
    if (!examMode) {
      fetchTests()
    }
  }, [fetchTests, examMode])

  const handleAutoSubmit = useCallback(async () => {
    if (!activeTestRef.current) return
    
    try {
      const token = localStorage.getItem('access_token')
      const answersArray = Object.keys(answersRef.current).map(questionId => ({
        question_id: parseInt(questionId),
        selected_answer: answersRef.current[questionId]
      }))
      
      const response = await fetch(`${API_BASE_URL}/student/tests/${activeTestRef.current.id}/submit`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answers: answersArray })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Alert yok, direkt çık
        setTestStarted(false)
        setActiveTest(null)
        setQuestions([])
        setAnswers({})
        setTimeRemaining(null)
        answersRef.current = {}
        activeTestRef.current = null
        
        // Full-screen moddan çık
        if (onExitExam && examMode) {
          onExitExam()
        } else {
          fetchTests()
        }
      } else {
        setError(data.error || 'Sınav gönderilemedi')
      }
    } catch (err) {
      console.error('Sınav gönderme hatası:', err)
      setError('Sınav gönderilemedi')
    }
  }, [fetchTests])

  useEffect(() => {
    if (testStarted && timeRemaining !== null && activeTest) {
      activeTestRef.current = activeTest
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Süre doldu, otomatik gönder
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
        
        // End time kontrolü
        if (activeTest && activeTest.end_time) {
          const now = new Date()
          const endTime = new Date(activeTest.end_time)
          if (now >= endTime) {
            // Bitiş saati geldi, otomatik gönder
            handleAutoSubmit()
          }
        }
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [testStarted, timeRemaining, activeTest, handleAutoSubmit])


  const handleStartTest = async (test) => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/student/tests/${test.id}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      
      console.log('🔍 Sınav başlatma response:', data) // DEBUG
      console.log('🔍 Sorular:', data.questions) // DEBUG
      console.log('🔍 Sorular sayısı:', data.questions?.length || 0) // DEBUG
      
      if (response.ok) {
        if (!data.questions || data.questions.length === 0) {
          console.error('❌ Sorular boş!', data)
          setError('Sınav soruları yüklenemedi. Lütfen tekrar deneyin.')
          return
        }
        
        console.log('✅ Sorular başarıyla yüklendi:', data.questions.length, 'soru')
        
        // Full-screen moda geç - VERİYİ GÖNDER
        if (onEnterExam && !examMode) {
          const examData = {
            test: test,
            questions: data.questions,
            remaining_time_seconds: data.remaining_time_seconds
          }
          console.log('📤 onEnterExam çağrılıyor, data gönderiliyor:', examData)
          onEnterExam(examData)
        } else {
          // Exam mode değilse (list mode'da), normal state set et
          setActiveTest(test)
          activeTestRef.current = test
          setQuestions(data.questions || [])
          setTimeRemaining(data.remaining_time_seconds)
          setTestStarted(true)
          setAnswers({})
          answersRef.current = {}
          setCurrentQuestionIndex(0)
        }
      } else {
        console.error('❌ Sınav başlatma hatası:', data.error) // DEBUG
        setError(data.error || 'Sınav başlatılamadı')
      }
    } catch (err) {
      console.error('Sınav başlatma hatası:', err)
      setError('Sınav başlatılamadı')
    }
  }

  const handleAnswerChange = (questionId, answer) => {
    const newAnswers = { ...answers, [questionId]: answer }
    setAnswers(newAnswers)
    answersRef.current = newAnswers
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleGoToQuestion = (index) => {
    setCurrentQuestionIndex(index)
  }

  const submitTest = async (isAuto = false) => {
    if (!activeTest) return
    
    try {
      const token = localStorage.getItem('access_token')
      const answersArray = Object.keys(answers).map(questionId => ({
        question_id: parseInt(questionId),
        selected_answer: answers[questionId]
      }))
      
      const response = await fetch(`${API_BASE_URL}/student/tests/${activeTest.id}/submit`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answers: answersArray })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Alert yok, direkt çık
        setTestStarted(false)
        setActiveTest(null)
        setQuestions([])
        setAnswers({})
        setTimeRemaining(null)
        
        // Full-screen moddan çık
        if (onExitExam && examMode) {
          onExitExam()
        } else {
          fetchTests()
        }
      } else {
        setError(data.error || 'Sınav gönderilemedi')
      }
    } catch (err) {
      console.error('Sınav gönderme hatası:', err)
      setError('Sınav gönderilemedi')
    }
  }

  const handleSubmitTest = async () => {
    // Onay dialog'u göster
    if (!window.confirm('Sınavı bitirmek istediğinize emin misiniz? Oturuma bir daha geri dönemeyeceksiniz.')) {
      return // Kullanıcı iptal etti
    }
    // Onaylandıysa direkt gönder (alert yok)
    await submitTest(false)
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const getTestStatus = (test) => {
    const now = new Date()
    const start = new Date(test.start_time)
    const end = new Date(test.end_time)
    
    if (test.attempt_status === 'submitted') return 'completed'
    if (test.attempt_status === 'started') return 'in-progress'
    if (now < start) return 'upcoming'
    if (now > end) return 'expired'
    return 'active'
  }

  const getStatusText = (status) => {
    switch(status) {
      case 'completed': return 'Tamamlandı'
      case 'in-progress': return 'Devam Ediyor'
      case 'upcoming': return 'Yaklaşan'
      case 'expired': return 'Süresi Doldu'
      case 'active': return 'Aktif'
      default: return 'Bilinmiyor'
    }
  }

  const getTimeUntilStart = (test) => {
    const now = new Date()
    const start = new Date(test.start_time)
    
    if (now >= start) return null // Başlamış veya geçmiş
    
    const diff = start - now
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) {
      return `${days} gün ${hours % 24} saat kaldı`
    } else if (hours > 0) {
      return `${hours} saat ${minutes} dakika kaldı`
    } else {
      return `${minutes} dakika kaldı`
    }
  }

  // Sınav ekranı - Yükleme kontrolü
  if (testStarted && activeTest) {
    if (questions.length === 0) {
      console.log('⏳ Sorular yükleniyor...')
      return React.createElement('div', { 
        style: { 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '20px'
        } 
      },
        React.createElement('h2', null, 'Sorular yükleniyor...'),
        React.createElement('p', null, 'Lütfen bekleyin'),
        error && React.createElement('p', { style: { color: 'red' } }, error)
      )
    }
    
    const currentQuestion = questions[currentQuestionIndex]
    
    return React.createElement('div', { className: 'new-exam-screen' },
      // Üst bar - Timer ve bilgi
      React.createElement('div', { className: 'new-exam-header' },
        React.createElement('div', { className: 'exam-header-left' },
          React.createElement('h3', { style: { margin: 0, color: '#1f2937', fontSize: '18px', fontWeight: '600' } }, 
            activeTest.lesson ? activeTest.lesson.name : 'Sınav'
          ),
          React.createElement('span', { style: { fontSize: '13px', color: '#6b7280', marginLeft: '12px' } },
            activeTest.test_type === 'vize' ? 'Vize Sınavı' : 'Final Sınavı'
          )
        ),
        React.createElement('div', { className: 'exam-header-right' },
          React.createElement('div', { className: 'timer-display' },
            React.createElement('span', { style: { fontSize: '14px', color: '#6b7280', marginRight: '8px' } }, 'Kalan Süre:'),
            React.createElement('span', { 
              style: { 
                fontSize: '18px', 
                fontWeight: '700', 
                color: timeRemaining < 300 ? '#dc2626' : '#059669',
                fontFamily: 'monospace'
              } 
            }, formatTime(timeRemaining))
          )
        )
      ),

      // Ana içerik - Sol navigasyon + Sağ soru alanı
      React.createElement('div', { className: 'new-exam-content' },
        // Sol navigasyon paneli
        React.createElement('div', { className: 'question-navigation' },
          React.createElement('div', { className: 'nav-header' },
            React.createElement('h4', { style: { margin: 0, fontSize: '14px', fontWeight: '600', color: '#374151' } }, 
              'SORULAR'
            ),
            React.createElement('span', { style: { fontSize: '12px', color: '#6b7280' } },
              `${currentQuestionIndex + 1} / ${questions.length}`
            )
          ),
          React.createElement('div', { className: 'nav-grid' },
            questions.map((q, idx) =>
              React.createElement('button', {
                key: q.id,
                className: `nav-question-btn ${idx === currentQuestionIndex ? 'active' : ''} ${answers[q.id] ? 'answered' : ''}`,
                onClick: () => handleGoToQuestion(idx)
              }, idx + 1)
            )
          )
        ),

        // Sağ soru alanı
        React.createElement('div', { className: 'question-display' },
          React.createElement('div', { className: 'question-header' },
            React.createElement('span', { className: 'question-badge' }, `Soru ${currentQuestionIndex + 1}`),
            React.createElement('span', { 
              className: 'answer-status',
              style: { 
                fontSize: '13px', 
                color: answers[currentQuestion.id] ? '#059669' : '#9ca3af',
                fontWeight: '500'
              } 
            }, answers[currentQuestion.id] ? '✓ Cevaplanmış' : 'Cevaplanmadı')
          ),

          React.createElement('div', { className: 'question-text-box' },
            React.createElement('p', { style: { fontSize: '16px', lineHeight: '1.6', color: '#1f2937', margin: 0 } }, 
              currentQuestion.question_text
            )
          ),

          React.createElement('div', { className: 'options-container' },
            ['a', 'b', 'c', 'd'].filter(opt => currentQuestion[`option_${opt}`]).map(option =>
              React.createElement('label', {
                key: option,
                className: `new-option ${answers[currentQuestion.id] === option ? 'selected' : ''}`,
                onClick: () => handleAnswerChange(currentQuestion.id, option)
              },
                React.createElement('input', {
                  type: 'radio',
                  name: `q_${currentQuestion.id}`,
                  value: option,
                  checked: answers[currentQuestion.id] === option,
                  onChange: () => {},
                  style: { display: 'none' }
                }),
                React.createElement('div', { className: 'option-circle' },
                  answers[currentQuestion.id] === option && React.createElement('div', { className: 'option-inner' })
                ),
                React.createElement('span', { className: 'option-letter' }, option.toUpperCase()),
                React.createElement('span', { className: 'option-content' }, currentQuestion[`option_${option}`])
              )
            )
          ),

          // Alt navigasyon butonları
          React.createElement('div', { className: 'question-actions' },
            React.createElement('button', {
              className: 'nav-btn prev-btn',
              onClick: handlePrevQuestion,
              disabled: currentQuestionIndex === 0,
              style: {
                opacity: currentQuestionIndex === 0 ? 0.4 : 1,
                cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer'
              }
            }, '← Önceki'),
            
            React.createElement('button', {
              className: 'finish-exam-btn',
              onClick: handleSubmitTest
            }, 'Sınavı Bitir'),

            React.createElement('button', {
              className: 'nav-btn next-btn',
              onClick: handleNextQuestion,
              disabled: currentQuestionIndex === questions.length - 1,
              style: {
                opacity: currentQuestionIndex === questions.length - 1 ? 0.4 : 1,
                cursor: currentQuestionIndex === questions.length - 1 ? 'not-allowed' : 'pointer'
              }
            }, 'Sonraki →')
          )
        )
      )
    )
  }

  // Sınav listesi
  return React.createElement('div', { className: 'student-exams-container' },
    React.createElement('h2', { className: 'exams-title' }, 'Sınavlarım'),

    error && React.createElement('div', { className: 'error-message' }, error),

    loading && React.createElement('p', { className: 'loading-text' }, 'Yükleniyor...'),

    !loading && tests.length === 0 && React.createElement('div', { className: 'empty-state' },
      React.createElement('h3', null, 'Aktif Sınav Yok'),
      React.createElement('p', null, 'Şu anda girebileceğiniz aktif bir sınav bulunmamaktadır.')
    ),

    !loading && tests.length > 0 && React.createElement('div', { className: 'exams-grid' },
      tests.map(test => {
        const status = getTestStatus(test)
        return React.createElement('div', { 
          key: test.id, 
          className: `exam-card ${status}`
        },
          React.createElement('div', { className: 'exam-card-header' },
            React.createElement('div', null,
              React.createElement('div', { className: 'exam-lesson' }, 
                test.lesson ? test.lesson.name : 'Ders Adı'
              ),
              React.createElement('div', { className: 'exam-type' }, 
                test.test_type === 'vize' ? 'Vize Sınavı' : 'Final Sınavı'
              )
            ),
            React.createElement('span', { className: `exam-status ${status}` }, 
              getStatusText(status)
            )
          ),

          React.createElement('div', { className: 'exam-details' },
            React.createElement('div', { className: 'exam-detail-item' },
              React.createElement('span', { className: 'detail-icon' }),
              React.createElement('div', null,
                React.createElement('div', { className: 'detail-label' }, 'Başlangıç'),
                React.createElement('div', { className: 'detail-value' }, formatDate(test.start_time))
              )
            ),
            React.createElement('div', { className: 'exam-detail-item' },
              React.createElement('span', { className: 'detail-icon' }),
              React.createElement('div', null,
                React.createElement('div', { className: 'detail-label' }, 'Bitiş'),
                React.createElement('div', { className: 'detail-value' }, formatDate(test.end_time))
              )
            ),
            React.createElement('div', { className: 'exam-detail-item' },
              React.createElement('span', { className: 'detail-icon' }),
              React.createElement('div', null,
                React.createElement('div', { className: 'detail-label' }, 'Süre'),
                React.createElement('div', { className: 'detail-value' }, 
                  `${Math.floor(test.duration / 60)} dakika`
                )
              )
            ),
            React.createElement('div', { className: 'exam-detail-item' },
              React.createElement('span', { className: 'detail-icon' }),
              React.createElement('div', null,
                React.createElement('div', { className: 'detail-label' }, 'Soru Sayısı'),
                React.createElement('div', { className: 'detail-value' }, 
                  `${test.min_questions} soru`
                )
              )
            )
          ),

          // Kalan süre (sadece yaklaşan sınavlar için)
          status === 'upcoming' && React.createElement('div', { 
            className: 'time-until-start',
            style: {
              padding: '12px',
              marginTop: '12px',
              backgroundColor: '#e7f3ff',
              borderRadius: '6px',
              textAlign: 'center',
              fontWeight: '600',
              color: '#0369a1',
              fontSize: '14px'
            }
          }, getTimeUntilStart(test)),

          status === 'active' && !test.attempt_status && 
            React.createElement('button', {
              className: 'start-exam-btn',
              onClick: () => handleStartTest(test)
            }, 'Sınava Gir'),

          status === 'completed' && 
            React.createElement('div', { className: 'exam-completed' }, 
              'Sınav tamamlandı'
            ),

          status === 'in-progress' && 
            React.createElement('div', { 
              className: 'exam-started-info',
              style: {
                padding: '12px',
                background: '#e5e7eb',
                color: '#374151',
                textAlign: 'center',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600'
              }
            }, 'Sınava Katılındı')
        )
      })
    )
  )
}

export default StudentExams

