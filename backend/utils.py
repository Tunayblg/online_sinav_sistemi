from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from datetime import datetime, timedelta
from database import db, User, Test, TestAttempt, Question, Answer, Grade, StudentLesson
import random
import re

# JWT Utils
def role_required(*allowed_roles):
    """JWT token kontrolü ve rol kontrolü yapan decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                verify_jwt_in_request()
                current_user_id = int(get_jwt_identity())
                user = User.query.get(current_user_id)
                
                if not user:
                    return jsonify({'error': 'User not found'}), 404
                
                if user.role.name not in allowed_roles:
                    return jsonify({'error': 'Insufficient permissions'}), 403
                
                return f(*args, **kwargs)
            except Exception as e:
                return jsonify({'error': str(e)}), 401
        return decorated_function
    return decorator

def get_current_user():
    """Mevcut kullanıcıyı döndürür"""
    try:
        verify_jwt_in_request()
        current_user_id = int(get_jwt_identity())
        return User.query.get(current_user_id)
    except:
        return None

# Validators
def validate_email(email):
    """Email formatını kontrol eder"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Şifre validasyonu (minimum 6 karakter)"""
    if not password or len(password) < 6:
        return False
    return True

def validate_datetime(dt_string):
    """Datetime string formatını kontrol eder (ISO format)"""
    try:
        datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        return True
    except:
        return False

def validate_test_time_window(start_time, end_time):
    """Test zaman penceresi validasyonu"""
    try:
        start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        end = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        
        if end <= start:
            return False, "End time must be after start time"
        
        return True, None
    except Exception as e:
        return False, f"Invalid datetime format: {str(e)}"

def validate_test_type(test_type):
    """Test tipi validasyonu"""
    return test_type in ['vize', 'final', 'quiz']

def validate_answer(answer):
    """Cevap validasyonu (a, b, c, d)"""
    return answer in ['a', 'b', 'c', 'd'] if answer else True

def validate_test_duration(start_time, end_time, duration_seconds):
    """Test süresi validasyonu - duration zaman penceresi süresinden fazla olamaz"""
    try:
        start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        end = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        
        time_window_seconds = int((end - start).total_seconds())
        
        if duration_seconds <= 0:
            return False, "Duration must be greater than 0"
        
        if duration_seconds > time_window_seconds:
            return False, f"Duration ({duration_seconds}s) cannot exceed time window ({time_window_seconds}s)"
        
        return True, None
    except Exception as e:
        return False, f"Invalid datetime format: {str(e)}"

# Exam Logic
def can_start_exam(test, student_id):
    """Öğrencinin sınavı başlatıp başlatamayacağını kontrol eder"""
    now = datetime.now()  # Lokal saat kullan (UTC yerine)
    
    student_enrollment = StudentLesson.query.filter_by(
        student_id=student_id,
        lesson_id=test.lesson_id
    ).first()
    
    if not student_enrollment:
        return False, "Bu derse kayıtlı değilsiniz"
    
    if now < test.start_time:
        return False, "Sınav henüz başlamadı"
    
    if now > test.end_time:
        return False, "Sınav süresi doldu"
    
    existing_attempt = TestAttempt.query.filter_by(
        test_id=test.id,
        student_id=student_id
    ).first()
    
    if existing_attempt:
        if existing_attempt.status == 'submitted':
            return False, "Bu sınavı zaten tamamladınız"
        elif existing_attempt.status == 'expired':
            return False, "Sınav süresi doldu"
        else:
            return False, "Bu sınavı zaten başlattınız. Çıktıktan sonra tekrar giremezsiniz."
    
    question_count = Question.query.filter_by(test_id=test.id).count()
    if question_count < test.min_questions:
        return False, f"Sınav için en az {test.min_questions} soru gereklidir"
    
    return True, None

def start_exam(test_id, student_id):
    """Sınavı başlatır ve rastgele soruları döndürür"""
    print(f"🔍 start_exam çağrıldı - test_id: {test_id}, student_id: {student_id}")
    
    test = Test.query.get_or_404(test_id)
    print(f"🔍 Test bulundu: {test.test_type}, min_questions: {test.min_questions}")
    
    existing_attempt = TestAttempt.query.filter_by(
        test_id=test_id,
        student_id=student_id
    ).first()
    
    if existing_attempt:
        print(f"❌ Zaten attempt var: {existing_attempt.status}")
        return None, "Bu sınavı zaten başlattınız. Çıktıktan sonra tekrar giremezsiniz."
    
    can_start, error = can_start_exam(test, student_id)
    if not can_start:
        print(f"❌ Sınava başlanamıyor: {error}")
        return None, error
    
    all_questions = Question.query.filter_by(test_id=test_id).all()
    print(f"🔍 Veritabanında {len(all_questions)} soru bulundu")
    
    if len(all_questions) < test.min_questions:
        print(f"❌ Yetersiz soru: {len(all_questions)} < {test.min_questions}")
        return None, f"Sınav için en az {test.min_questions} soru gereklidir"
    
    random.shuffle(all_questions)
    selected_questions = all_questions[:test.min_questions] if len(all_questions) > test.min_questions else all_questions
    print(f"🔍 {len(selected_questions)} soru seçildi")
    
    attempt = TestAttempt(
        test_id=test_id,
        student_id=student_id,
        started_at=datetime.now(),
        status='started'
    )
    db.session.add(attempt)
    db.session.flush()
    
    for question in selected_questions:
        answer = Answer(
            attempt_id=attempt.id,
            question_id=question.id,
            selected_answer=None,
            is_correct=False,
            points_earned=0.00
        )
        db.session.add(answer)
    
    db.session.commit()
    
    questions_data = [q.to_dict(include_correct=False) for q in selected_questions]
    print(f"✅ Sorular hazırlandı: {len(questions_data)} soru")
    print(f"✅ İlk soru: {questions_data[0] if questions_data else 'YOK'}")
    
    return attempt, questions_data

def check_exam_expired(attempt):
    """Sınavın süresi dolmuş mu kontrol eder"""
    test = attempt.test
    now = datetime.now()
    
    if now > test.end_time:
        return True, "Sınav süresi doldu"
    
    elapsed = (now - attempt.started_at).total_seconds()
    if elapsed > test.duration:
        return True, "Sınav süresi doldu"
    
    return False, None

def submit_exam(attempt_id, answers_data):
    """Sınavı gönderir ve puanı hesaplar"""
    attempt = TestAttempt.query.get_or_404(attempt_id)
    
    if attempt.status == 'submitted':
        return attempt, "Sınav zaten gönderildi"
    
    is_expired, error = check_exam_expired(attempt)
    if is_expired:
        attempt.status = 'expired'
        attempt.submitted_at = datetime.now()
        db.session.commit()
        return attempt, error
    
    total_score = 0.00
    for answer_data in answers_data:
        question_id = answer_data.get('question_id')
        selected_answer = answer_data.get('selected_answer')
        
        answer = Answer.query.filter_by(
            attempt_id=attempt_id,
            question_id=question_id
        ).first()
        
        if answer:
            question = Question.query.get(question_id)
            answer.selected_answer = selected_answer
            
            if selected_answer and question.correct_answer == selected_answer:
                answer.is_correct = True
                answer.points_earned = question.points
                total_score += question.points
            else:
                answer.is_correct = False
                answer.points_earned = 0.00
    
    attempt.score = total_score
    attempt.status = 'submitted'
    attempt.submitted_at = datetime.now()
    
    update_grade(attempt.test, attempt.student_id, attempt.score)
    
    db.session.commit()
    
    return attempt, None

def update_grade(test, student_id, score):
    """Ders notunu günceller (vize/final ağırlıklarına göre)"""
    grade = Grade.query.filter_by(
        student_id=student_id,
        lesson_id=test.lesson_id
    ).first()
    
    if not grade:
        grade = Grade(
            student_id=student_id,
            lesson_id=test.lesson_id
        )
        db.session.add(grade)
    
    if test.test_type == 'vize':
        grade.vize_score = score
    elif test.test_type == 'final':
        grade.final_score = score
    elif test.test_type == 'quiz':
        grade.quiz_score = score
    
    if grade.vize_score is not None and grade.final_score is not None:
        vize_weight = float(test.vize_weight) / 100.0
        final_weight = float(test.final_weight) / 100.0
        grade.total_score = (float(grade.vize_score) * vize_weight) + (float(grade.final_score) * final_weight)
    elif grade.vize_score is not None:
        grade.total_score = float(grade.vize_score)
    elif grade.final_score is not None:
        grade.total_score = float(grade.final_score)
    
    db.session.commit()

def get_random_questions(test_id, limit=None):
    """Test için rastgele soruları döndürür"""
    questions = Question.query.filter_by(test_id=test_id).all()
    if limit and len(questions) > limit:
        random.shuffle(questions)
        return questions[:limit]
    return questions

