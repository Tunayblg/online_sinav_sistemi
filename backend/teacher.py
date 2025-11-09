from flask import Blueprint, request, jsonify
from database import db, User, Lesson, Test, Question, TeacherLesson, TestAttempt, Answer, Grade, StudentLesson
from utils import role_required, get_current_user, validate_test_time_window, validate_test_type, validate_test_duration
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

teacher_bp = Blueprint('teacher', __name__)

@teacher_bp.route('/lessons', methods=['GET'])
@jwt_required()
@role_required('teacher')
def get_teacher_lessons():
    """Öğretmenin derslerini listele"""
    current_user_id = int(get_jwt_identity())
    
    teacher_lessons = TeacherLesson.query.filter_by(teacher_id=current_user_id).all()
    lessons = [tl.lesson.to_dict() for tl in teacher_lessons]
    
    return jsonify({
        'lessons': lessons
    }), 200

@teacher_bp.route('/lessons/<int:lesson_id>', methods=['GET'])
@jwt_required()
@role_required('teacher')
def get_lesson_detail(lesson_id):
    """Ders detaylarını getir (vize/final oranları, testler)"""
    current_user_id = int(get_jwt_identity())
    
    teacher_assignment = TeacherLesson.query.filter_by(
        teacher_id=current_user_id,
        lesson_id=lesson_id
    ).first()
    
    if not teacher_assignment:
        return jsonify({'error': 'You are not assigned to this lesson'}), 403
    
    lesson = Lesson.query.get_or_404(lesson_id)
    tests = Test.query.filter_by(lesson_id=lesson_id, teacher_id=current_user_id).all()
    
    # Ağırlıkları ders tablosundan al
    vize_weight = float(lesson.vize_weight) if lesson.vize_weight else 40.00
    final_weight = float(lesson.final_weight) if lesson.final_weight else 60.00
    
    tests_data = []
    for test in tests:
        test_data = test.to_dict()
        test_data['question_count'] = Question.query.filter_by(test_id=test.id).count()
        tests_data.append(test_data)
    
    # Öğrencileri ve notlarını getir
    student_lessons = StudentLesson.query.filter_by(lesson_id=lesson_id).all()
    students_with_grades = []
    
    for sl in student_lessons:
        student = sl.student
        grade = Grade.query.filter_by(student_id=student.id, lesson_id=lesson_id).first()
        
        student_data = {
            'id': student.id,
            'full_name': student.full_name,
            'email': student.email,
            'student_number': student.student_number,
            'vize_score': float(grade.vize_score) if grade and grade.vize_score else None,
            'final_score': float(grade.final_score) if grade and grade.final_score else None,
            'total_score': float(grade.total_score) if grade and grade.total_score else None
        }
        students_with_grades.append(student_data)
    
    return jsonify({
        'lesson': lesson.to_dict(),
        'vize_weight': vize_weight,
        'final_weight': final_weight,
        'tests': tests_data,
        'test_count': len(tests_data),
        'students': students_with_grades
    }), 200

@teacher_bp.route('/lessons/<int:lesson_id>/tests', methods=['GET'])
@jwt_required()
@role_required('teacher')
def get_lesson_tests(lesson_id):
    """Dersin testlerini listele"""
    current_user_id = int(get_jwt_identity())
    
    teacher_assignment = TeacherLesson.query.filter_by(
        teacher_id=current_user_id,
        lesson_id=lesson_id
    ).first()
    
    if not teacher_assignment:
        return jsonify({'error': 'You are not assigned to this lesson'}), 403
    
    tests = Test.query.filter_by(lesson_id=lesson_id, teacher_id=current_user_id).all()
    
    tests_data = []
    for test in tests:
        test_data = test.to_dict()
        test_data['question_count'] = Question.query.filter_by(test_id=test.id).count()
        tests_data.append(test_data)
    
    return jsonify({
        'tests': tests_data,
        'total': len(tests_data)
    }), 200

@teacher_bp.route('/tests', methods=['POST'])
@jwt_required()
@role_required('teacher')
def create_test():
    """Yeni test oluştur"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    lesson_id = data.get('lesson_id')
    test_type = data.get('test_type')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    duration_minutes = data.get('duration')
    min_questions = data.get('min_questions', 5)
    vize_weight = data.get('vize_weight', 40.00)
    final_weight = data.get('final_weight', 60.00)
    
    if not all([lesson_id, test_type, start_time, end_time, duration_minutes]):
        return jsonify({'error': 'All required fields must be provided'}), 400
    
    teacher_assignment = TeacherLesson.query.filter_by(
        teacher_id=current_user_id,
        lesson_id=lesson_id
    ).first()
    
    if not teacher_assignment:
        return jsonify({'error': 'You are not assigned to this lesson'}), 403
    
    lesson = Lesson.query.get(lesson_id)
    if not lesson:
        return jsonify({'error': 'Lesson not found'}), 404
    
    if not validate_test_type(test_type):
        return jsonify({'error': 'Invalid test type. Must be "vize" or "final"'}), 400
    
    # Çakışma kontrolü: Aynı derste aynı türde sınav var mı?
    existing_test = Test.query.filter_by(
        lesson_id=lesson_id,
        teacher_id=current_user_id,
        test_type=test_type
    ).first()
    
    if existing_test:
        test_type_tr = 'Vize' if test_type == 'vize' else 'Final'
        return jsonify({'error': f'Bu ders için zaten bir {test_type_tr} sınavı oluşturulmuş!'}), 400
    
    is_valid, error = validate_test_time_window(start_time, end_time)
    if not is_valid:
        return jsonify({'error': error}), 400
    
    duration_seconds = int(duration_minutes) * 60
    
    is_valid_duration, error_duration = validate_test_duration(start_time, end_time, duration_seconds)
    if not is_valid_duration:
        return jsonify({'error': error_duration}), 400
    
    if abs(float(vize_weight) + float(final_weight) - 100.00) > 0.01:
        return jsonify({'error': 'Vize weight + Final weight must equal 100'}), 400
    
    try:
        start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    except Exception as e:
        return jsonify({'error': f'Invalid datetime format: {str(e)}'}), 400
    
    test = Test(
        lesson_id=lesson_id,
        teacher_id=current_user_id,
        test_type=test_type,
        start_time=start_dt,
        end_time=end_dt,
        duration=duration_seconds,
        min_questions=min_questions,
        vize_weight=vize_weight,
        final_weight=final_weight
    )
    
    db.session.add(test)
    db.session.commit()
    
    return jsonify({
        'message': 'Test created successfully',
        'test': test.to_dict()
    }), 201

@teacher_bp.route('/tests/<int:test_id>', methods=['DELETE'])
@jwt_required()
@role_required('teacher')
def delete_test(test_id):
    """Testi sil"""
    current_user_id = int(get_jwt_identity())
    
    test = Test.query.get_or_404(test_id)
    
    if test.teacher_id != current_user_id:
        return jsonify({'error': 'You are not authorized to delete this test'}), 403
    
    # Test'e ait soruları ve cevapları da sil
    questions = Question.query.filter_by(test_id=test_id).all()
    for question in questions:
        Answer.query.filter_by(question_id=question.id).delete()
        db.session.delete(question)
    
    # Test attempt'leri sil
    TestAttempt.query.filter_by(test_id=test_id).delete()
    
    # Test'i sil
    db.session.delete(test)
    db.session.commit()
    
    return jsonify({'message': 'Test deleted successfully'}), 200

@teacher_bp.route('/tests/<int:test_id>', methods=['GET'])
@jwt_required()
@role_required('teacher')
def get_test(test_id):
    """Test detaylarını ve sorularını getir"""
    current_user_id = int(get_jwt_identity())
    
    test = Test.query.get_or_404(test_id)
    
    if test.teacher_id != current_user_id:
        return jsonify({'error': 'You are not authorized to view this test'}), 403
    
    # Soruları da ekle
    questions = Question.query.filter_by(test_id=test_id).order_by(Question.id).all()
    questions_data = [q.to_dict(include_correct=True) for q in questions]
    
    return jsonify({
        'test': test.to_dict(),
        'questions': questions_data
    }), 200

@teacher_bp.route('/tests/<int:test_id>/questions', methods=['DELETE'])
@jwt_required()
@role_required('teacher')
def delete_all_questions(test_id):
    """Test'in tüm sorularını sil"""
    current_user_id = int(get_jwt_identity())
    
    test = Test.query.get_or_404(test_id)
    
    if test.teacher_id != current_user_id:
        return jsonify({'error': 'You are not authorized to delete questions from this test'}), 403
    
    # Tüm soruları ve ilgili cevapları sil
    questions = Question.query.filter_by(test_id=test_id).all()
    for question in questions:
        Answer.query.filter_by(question_id=question.id).delete()
        db.session.delete(question)
    
    db.session.commit()
    
    return jsonify({'message': 'All questions deleted successfully'}), 200

@teacher_bp.route('/tests/<int:test_id>/questions', methods=['POST'])
@jwt_required()
@role_required('teacher')
def add_question(test_id):
    """Teste soru ekle"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    test = Test.query.get_or_404(test_id)
    
    if test.teacher_id != current_user_id:
        return jsonify({'error': 'You are not authorized to add questions to this test'}), 403
    
    question_text = data.get('question_text')
    option_a = data.get('option_a')
    option_b = data.get('option_b')
    option_c = data.get('option_c')
    option_d = data.get('option_d')
    correct_answer = data.get('correct_answer')
    
    if not all([question_text, option_a, option_b, option_c, option_d, correct_answer]):
        return jsonify({'error': 'All question fields are required'}), 400
    
    if correct_answer not in ['a', 'b', 'c', 'd']:
        return jsonify({'error': 'Correct answer must be a, b, c, or d'}), 400
    
    # Puan otomatik hesaplanacak, geçici olarak 10
    question = Question(
        test_id=test_id,
        question_text=question_text,
        option_a=option_a,
        option_b=option_b,
        option_c=option_c,
        option_d=option_d,
        correct_answer=correct_answer,
        points=10  # Geçici, sonra güncellenecek
    )
    
    db.session.add(question)
    db.session.flush()  # ID'yi almak için
    
    # Tüm soruları eşit puan yap (sınavda gösterilecek soru sayısına göre)
    # Örn: min_questions=5 ise, her soru 100/5=20 puan (havuzda 20 soru olsa bile)
    points_per_question = 100.0 / test.min_questions
    all_questions = Question.query.filter_by(test_id=test_id).all()
    for q in all_questions:
        q.points = int(round(points_per_question))
    
    db.session.commit()
    
    return jsonify({
        'message': 'Question added successfully',
        'question': question.to_dict(include_correct=True)
    }), 201

@teacher_bp.route('/tests/<int:test_id>/questions/bulk', methods=['POST'])
@jwt_required()
@role_required('teacher')
def bulk_add_questions(test_id):
    """Toplu soru ekle (Excel'den gelen veri)"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    test = Test.query.get_or_404(test_id)
    
    if test.teacher_id != current_user_id:
        return jsonify({'error': 'You are not authorized to add questions to this test'}), 403
    
    questions_data = data.get('questions', [])
    
    if not questions_data:
        return jsonify({'error': 'No questions provided'}), 400
    
    results = {
        'created': [],
        'errors': []
    }
    
    for idx, question_data in enumerate(questions_data, start=1):
        try:
            question_text = question_data.get('question_text', '').strip()
            option_a = question_data.get('option_a', '').strip()
            option_b = question_data.get('option_b', '').strip()
            option_c = question_data.get('option_c', '').strip()
            option_d = question_data.get('option_d', '').strip()
            correct_answer = question_data.get('correct_answer', '').strip().lower()
            points = question_data.get('points', 10)
            
            # Validasyon
            if not question_text:
                results['errors'].append({
                    'row': idx,
                    'error': 'Soru metni boş olamaz',
                    'data': question_data
                })
                continue
            
            if not option_a or not option_b:
                results['errors'].append({
                    'row': idx,
                    'error': 'A ve B şıkları zorunludur',
                    'data': question_data
                })
                continue
            
            # C ve D şıklarını kontrol et - en az biri dolu olmalı
            if not option_c and not option_d:
                results['errors'].append({
                    'row': idx,
                    'error': 'En az 3 şık (A, B ve C veya D) gereklidir',
                    'data': question_data
                })
                continue
            
            # Doğru cevap kontrolü
            if correct_answer not in ['a', 'b', 'c', 'd']:
                results['errors'].append({
                    'row': idx,
                    'error': f'Geçersiz doğru cevap: {correct_answer}. a, b, c veya d olmalıdır',
                    'data': question_data
                })
                continue
            
            # Doğru cevabın şıkkı dolu mu kontrol et
            if correct_answer == 'c' and not option_c:
                results['errors'].append({
                    'row': idx,
                    'error': 'Doğru cevap C seçili ama C şıkkı boş',
                    'data': question_data
                })
                continue
            
            if correct_answer == 'd' and not option_d:
                results['errors'].append({
                    'row': idx,
                    'error': 'Doğru cevap D seçili ama D şıkkı boş',
                    'data': question_data
                })
                continue
            
            # Boş şıkları varsayılan değerle doldur
            if not option_c:
                option_c = '-'
            if not option_d:
                option_d = '-'
            
            # Soruyu oluştur (puan geçici olarak 10, sonra güncellenecek)
            question = Question(
                test_id=test_id,
                question_text=question_text,
                option_a=option_a,
                option_b=option_b,
                option_c=option_c,
                option_d=option_d,
                correct_answer=correct_answer,
                points=10  # Geçici, sonra güncellenecek
            )
            
            db.session.add(question)
            results['created'].append({
                'row': idx,
                'question_text': question_text[:50] + '...' if len(question_text) > 50 else question_text
            })
        
        except Exception as e:
            db.session.rollback()
            results['errors'].append({
                'row': idx,
                'error': str(e),
                'data': question_data
            })
    
    # Hepsini kaydet
    try:
        db.session.commit()
        
        # Tüm soruları eşit puan yap (sınavda gösterilecek soru sayısına göre)
        # Örn: min_questions=5 ise, her soru 100/5=20 puan (havuzda 20 soru olsa bile)
        points_per_question = 100.0 / test.min_questions
        all_questions = Question.query.filter_by(test_id=test_id).all()
        for q in all_questions:
            q.points = int(round(points_per_question))
        db.session.commit()
        
        # Yükleme sonrası toplam soru sayısını kontrol et
        total_questions = Question.query.filter_by(test_id=test_id).count()
        min_required = test.min_questions
        
        if total_questions < min_required:
            return jsonify({
                'error': f'Soru havuzu yetersiz. Sınav için minimum {min_required} soru gereklidir, mevcut: {total_questions}.',
                'warning': True,
                'summary': {
                    'created_count': len(results['created']),
                    'error_count': len(results['errors']),
                    'total_questions': total_questions,
                    'required_questions': min_required
                }
            }), 400
        
        return jsonify({
            'message': 'Toplu soru yükleme tamamlandı',
            'summary': {
                'created_count': len(results['created']),
                'error_count': len(results['errors']),
                'total_questions': total_questions,
                'required_questions': min_required
            },
            'results': results
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': f'Sorular kaydedilirken hata oluştu: {str(e)}'
        }), 500

@teacher_bp.route('/tests/<int:test_id>/results', methods=['GET'])
@jwt_required()
@role_required('teacher')
def get_test_results(test_id):
    """Test sonuçlarını getir"""
    current_user_id = int(get_jwt_identity())
    
    test = Test.query.get_or_404(test_id)
    
    if test.teacher_id != current_user_id:
        return jsonify({'error': 'You are not authorized to view this test results'}), 403
    
    attempts = TestAttempt.query.filter_by(test_id=test_id).all()
    
    results = []
    for attempt in attempts:
        attempt_data = attempt.to_dict()
        answers = Answer.query.filter_by(attempt_id=attempt.id).all()
        attempt_data['answers'] = [answer.to_dict() for answer in answers]
        results.append(attempt_data)
    
    return jsonify({
        'test': test.to_dict(),
        'results': results,
        'total_attempts': len(results)
    }), 200

@teacher_bp.route('/lessons/<int:lesson_id>/weights', methods=['PUT'])
@jwt_required()
@role_required('teacher')
def update_lesson_weights(lesson_id):
    """Dersin ağırlıklarını güncelle (vize/final)"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Öğretmenin bu derse erişimi var mı kontrol et
    teacher_assignment = TeacherLesson.query.filter_by(
        teacher_id=current_user_id,
        lesson_id=lesson_id
    ).first()
    
    if not teacher_assignment:
        return jsonify({'error': 'You are not assigned to this lesson'}), 403
    
    vize_weight = data.get('vize_weight')
    final_weight = data.get('final_weight')
    
    if vize_weight is None or final_weight is None:
        return jsonify({'error': 'Both vize_weight and final_weight are required'}), 400
    
    if abs(float(vize_weight) + float(final_weight) - 100.00) > 0.01:
        return jsonify({'error': 'Vize weight + Final weight must equal 100'}), 400
    
    # Dersin ağırlıklarını güncelle (Lesson tablosuna kaydet)
    lesson = Lesson.query.get_or_404(lesson_id)
    lesson.vize_weight = vize_weight
    lesson.final_weight = final_weight
    
    # Bu derse ait tüm testlerin ağırlıklarını da güncelle (opsiyonel, tutarlılık için)
    tests = Test.query.filter_by(lesson_id=lesson_id, teacher_id=current_user_id).all()
    for test in tests:
        test.vize_weight = vize_weight
        test.final_weight = final_weight
    
    db.session.commit()
    
    return jsonify({
        'message': 'Lesson weights updated successfully',
        'vize_weight': float(vize_weight),
        'final_weight': float(final_weight),
        'updated_tests': len(tests)
    }), 200

@teacher_bp.route('/tests/<int:test_id>/weights', methods=['PUT'])
@jwt_required()
@role_required('teacher')
def update_test_weights(test_id):
    """Test ağırlıklarını güncelle (vize/final)"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    test = Test.query.get_or_404(test_id)
    
    if test.teacher_id != current_user_id:
        return jsonify({'error': 'You are not authorized to update this test'}), 403
    
    vize_weight = data.get('vize_weight')
    final_weight = data.get('final_weight')
    
    if vize_weight is None or final_weight is None:
        return jsonify({'error': 'Both vize_weight and final_weight are required'}), 400
    
    if abs(float(vize_weight) + float(final_weight) - 100.00) > 0.01:
        return jsonify({'error': 'Vize weight + Final weight must equal 100'}), 400
    
    test.vize_weight = vize_weight
    test.final_weight = final_weight
    
    db.session.commit()
    
    return jsonify({
        'message': 'Test weights updated successfully',
        'test': test.to_dict()
    }), 200

