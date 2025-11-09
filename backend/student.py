from flask import Blueprint, request, jsonify
from database import db, User, Lesson, Test, TestAttempt, Question, Answer, StudentLesson, Grade
from utils import role_required, get_current_user, start_exam, submit_exam, check_exam_expired
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

student_bp = Blueprint('student', __name__)

@student_bp.route('/lessons', methods=['GET'])
@jwt_required()
@role_required('student')
def get_student_lessons():
    """Öğrencinin derslerini listele"""
    current_user_id = int(get_jwt_identity())
    
    student_lessons = StudentLesson.query.filter_by(student_id=current_user_id).all()
    
    lessons = []
    for sl in student_lessons:
        lesson_data = sl.lesson.to_dict()
        grade = Grade.query.filter_by(
            student_id=current_user_id,
            lesson_id=sl.lesson_id
        ).first()
        
        if grade:
            lesson_data['grade'] = {
                'vize_score': float(grade.vize_score) if grade.vize_score else None,
                'final_score': float(grade.final_score) if grade.final_score else None,
                'total_score': float(grade.total_score) if grade.total_score else None
            }
        else:
            lesson_data['grade'] = None
        
        # Dersin sınıf ortalamasını hesapla
        all_grades = Grade.query.filter_by(lesson_id=sl.lesson_id).all()
        total_scores = [float(g.total_score) for g in all_grades if g.total_score is not None]
        if total_scores:
            lesson_data['class_average'] = sum(total_scores) / len(total_scores)
        else:
            lesson_data['class_average'] = None
        
        lessons.append(lesson_data)
    
    return jsonify({
        'lessons': lessons
    }), 200

@student_bp.route('/tests/available', methods=['GET'])
@jwt_required()
@role_required('student')
def get_available_tests():
    """Tüm testleri listele (gelecek, aktif, geçmiş)"""
    current_user_id = int(get_jwt_identity())
    now = datetime.now()
    
    student_lessons = StudentLesson.query.filter_by(student_id=current_user_id).all()
    lesson_ids = [sl.lesson_id for sl in student_lessons]
    
    if not lesson_ids:
        return jsonify({
            'tests': []
        }), 200
    
    # Tüm sınavları getir (gelecek, aktif, geçmiş), start_time'a göre sırala
    available_tests = Test.query.filter(
        Test.lesson_id.in_(lesson_ids)
    ).order_by(Test.start_time.desc()).all()
    
    tests_data = []
    for test in available_tests:
        test_data = test.to_dict()
        
        attempt = TestAttempt.query.filter_by(
            test_id=test.id,
            student_id=current_user_id
        ).first()
        
        if attempt:
            test_data['attempt_status'] = attempt.status
            test_data['attempt_id'] = attempt.id
            test_data['started_at'] = attempt.started_at.isoformat() if attempt.started_at else None
            test_data['can_continue'] = False
        else:
            test_data['attempt_status'] = None
            test_data['attempt_id'] = None
            test_data['can_continue'] = True
        
        tests_data.append(test_data)
    
    return jsonify({
        'tests': tests_data
    }), 200

@student_bp.route('/tests/<int:test_id>/start', methods=['POST'])
@jwt_required()
@role_required('student')
def start_test(test_id):
    """Sınavı başlat"""
    current_user_id = int(get_jwt_identity())
    
    attempt, questions_data = start_exam(test_id, current_user_id)
    
    if not attempt:
        return jsonify({'error': questions_data}), 400
    
    test = Test.query.get(test_id)
    elapsed = (datetime.now() - attempt.started_at).total_seconds()
    remaining_time = test.duration - elapsed
    
    return jsonify({
        'message': 'Test started successfully',
        'attempt': attempt.to_dict(),
        'questions': questions_data,
        'remaining_time_seconds': max(0, int(remaining_time)),
        'duration_seconds': test.duration,
        'end_time': test.end_time.isoformat() if test.end_time else None
    }), 200

@student_bp.route('/tests/<int:test_id>/attempt', methods=['GET'])
@jwt_required()
@role_required('student')
def get_test_attempt(test_id):
    """Sınav durumunu getir (sorular, kalan süre, mevcut cevaplar)"""
    current_user_id = int(get_jwt_identity())
    
    attempt = TestAttempt.query.filter_by(
        test_id=test_id,
        student_id=current_user_id
    ).first()
    
    if not attempt:
        return jsonify({'error': 'You have not started this test'}), 404
    
    test = Test.query.get_or_404(test_id)
    
    answers = Answer.query.filter_by(attempt_id=attempt.id).all()
    question_ids = [answer.question_id for answer in answers]
    questions = Question.query.filter(Question.id.in_(question_ids)).all()
    
    questions_data = []
    for question in questions:
        question_dict = question.to_dict(include_correct=False)
        
        answer = next((a for a in answers if a.question_id == question.id), None)
        if answer:
            question_dict['selected_answer'] = answer.selected_answer
        else:
            question_dict['selected_answer'] = None
        
        questions_data.append(question_dict)
    
    now = datetime.now()
    elapsed = (now - attempt.started_at).total_seconds()
    remaining_time = test.duration - elapsed
    
    time_window_expired = now > test.end_time
    duration_expired = elapsed > test.duration
    
    return jsonify({
        'attempt': attempt.to_dict(),
        'questions': questions_data,
        'remaining_time_seconds': max(0, int(remaining_time)),
        'duration_seconds': test.duration,
        'end_time': test.end_time.isoformat() if test.end_time else None,
        'time_window_expired': time_window_expired,
        'duration_expired': duration_expired,
        'can_continue': attempt.status == 'started' and not time_window_expired and not duration_expired
    }), 200

@student_bp.route('/tests/<int:test_id>/submit', methods=['POST'])
@jwt_required()
@role_required('student')
def submit_test(test_id):
    """Sınavı gönder (cevapları kaydet ve puanı hesapla)"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    answers_data = data.get('answers', [])
    
    if not answers_data:
        return jsonify({'error': 'Answers are required'}), 400
    
    attempt = TestAttempt.query.filter_by(
        test_id=test_id,
        student_id=current_user_id
    ).first()
    
    if not attempt:
        return jsonify({'error': 'You have not started this test'}), 404
    
    submitted_attempt, error = submit_exam(attempt.id, answers_data)
    
    if error:
        return jsonify({'error': error}), 400
    
    return jsonify({
        'message': 'Test submitted successfully',
        'attempt': submitted_attempt.to_dict(),
        'score': float(submitted_attempt.score) if submitted_attempt.score else 0.00
    }), 200

@student_bp.route('/tests/<int:test_id>/result', methods=['GET'])
@jwt_required()
@role_required('student')
def get_test_result(test_id):
    """Sınav sonuçlarını görüntüle"""
    current_user_id = int(get_jwt_identity())
    
    attempt = TestAttempt.query.filter_by(
        test_id=test_id,
        student_id=current_user_id
    ).first()
    
    if not attempt:
        return jsonify({'error': 'You have not taken this test'}), 404
    
    test = Test.query.get_or_404(test_id)
    
    answers = Answer.query.filter_by(attempt_id=attempt.id).all()
    
    results = []
    for answer in answers:
        question = Question.query.get(answer.question_id)
        if question:
            result_item = {
                'question': question.to_dict(include_correct=True),
                'selected_answer': answer.selected_answer,
                'correct_answer': question.correct_answer,
                'is_correct': answer.is_correct,
                'points_earned': float(answer.points_earned) if answer.points_earned else 0.00,
                'question_points': question.points
            }
            results.append(result_item)
    
    grade = Grade.query.filter_by(
        student_id=current_user_id,
        lesson_id=test.lesson_id
    ).first()
    
    grade_data = None
    if grade:
        grade_data = {
            'vize_score': float(grade.vize_score) if grade.vize_score else None,
            'final_score': float(grade.final_score) if grade.final_score else None,
            'quiz_score': float(grade.quiz_score) if grade.quiz_score else None,
            'total_score': float(grade.total_score) if grade.total_score else None
        }
    
    return jsonify({
        'attempt': attempt.to_dict(),
        'test': test.to_dict(),
        'results': results,
        'total_score': float(attempt.score) if attempt.score else 0.00,
        'grade': grade_data
    }), 200

