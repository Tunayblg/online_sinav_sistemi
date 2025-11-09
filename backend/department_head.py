from flask import Blueprint, request, jsonify
from database import db, Lesson, Test, Grade, StudentLesson, TeacherLesson, User, TestAttempt, Role
from utils import role_required
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func

dept_head_bp = Blueprint('department_head', __name__)

@dept_head_bp.route('/lessons', methods=['GET'])
@jwt_required()
@role_required('department_head')
def get_all_lessons():
    """Tüm dersleri listele"""
    lessons = Lesson.query.all()
    
    lessons_data = []
    for lesson in lessons:
        lesson_dict = lesson.to_dict()
        
        student_count = StudentLesson.query.filter_by(lesson_id=lesson.id).count()
        lesson_dict['student_count'] = student_count
        
        teachers = TeacherLesson.query.filter_by(lesson_id=lesson.id).all()
        lesson_dict['teachers'] = [tl.teacher.to_dict() for tl in teachers]
        
        grades = Grade.query.filter_by(lesson_id=lesson.id).all()
        if grades:
            total_scores = [float(g.total_score) for g in grades if g.total_score is not None]
            if total_scores:
                lesson_dict['average_score'] = sum(total_scores) / len(total_scores)
            else:
                lesson_dict['average_score'] = None
        else:
            lesson_dict['average_score'] = None
        
        lessons_data.append(lesson_dict)
    
    return jsonify({
        'lessons': lessons_data
    }), 200

@dept_head_bp.route('/lessons/<int:lesson_id>', methods=['GET'])
@jwt_required()
@role_required('department_head')
def get_lesson_detail(lesson_id):
    """Ders detaylarını getir (öğrenciler, ortalamalar, öğretmenler, bölüm bazında ortalamalar)"""
    lesson = Lesson.query.get_or_404(lesson_id)
    
    student_lessons = StudentLesson.query.filter_by(lesson_id=lesson_id).all()
    
    students_data = []
    for sl in student_lessons:
        student = sl.student
        student_dict = student.to_dict()
        
        grade = Grade.query.filter_by(
            student_id=student.id,
            lesson_id=lesson_id
        ).first()
        
        if grade:
            student_dict['grade'] = {
                'vize_score': float(grade.vize_score) if grade.vize_score else None,
                'final_score': float(grade.final_score) if grade.final_score else None,
                'quiz_score': float(grade.quiz_score) if grade.quiz_score else None,
                'total_score': float(grade.total_score) if grade.total_score else None
            }
        else:
            student_dict['grade'] = None
        
        students_data.append(student_dict)
    
    total_students = len(students_data)
    
    teachers = TeacherLesson.query.filter_by(lesson_id=lesson_id).all()
    teachers_data = [tl.teacher.to_dict() for tl in teachers]
    
    tests = Test.query.filter_by(lesson_id=lesson_id).all()
    
    vize_scores = []
    final_scores = []
    quiz_scores = []
    total_scores = []
    
    for grade in Grade.query.filter_by(lesson_id=lesson_id).all():
        if grade.vize_score is not None:
            vize_scores.append(float(grade.vize_score))
        if grade.final_score is not None:
            final_scores.append(float(grade.final_score))
        if grade.total_score is not None:
            total_scores.append(float(grade.total_score))
    
    quiz_tests = [t for t in tests if t.test_type == 'quiz']
    for quiz_test in quiz_tests:
        quiz_attempts = TestAttempt.query.filter_by(test_id=quiz_test.id).all()
        for attempt in quiz_attempts:
            if attempt.score is not None:
                quiz_scores.append(float(attempt.score))
    
    averages = {
        'vize_average': sum(vize_scores) / len(vize_scores) if vize_scores else None,
        'final_average': sum(final_scores) / len(final_scores) if final_scores else None,
        'quiz_average': sum(quiz_scores) / len(quiz_scores) if quiz_scores else None,
        'total_average': sum(total_scores) / len(total_scores) if total_scores else None
    }
    
    department_averages = {}
    
    student_role = Role.query.filter_by(name='student').first()
    if student_role:
        departments = db.session.query(User.department).filter(
            User.role_id == student_role.id,
            User.department.isnot(None)
        ).distinct().all()
        
        for dept_tuple in departments:
            dept_name = dept_tuple[0]
            if not dept_name:
                continue
            
            dept_students = db.session.query(User).join(StudentLesson).filter(
                User.department == dept_name,
                StudentLesson.lesson_id == lesson_id,
                User.role_id == student_role.id
            ).all()
            
            if dept_students:
                dept_grades = []
                for student in dept_students:
                    grade = Grade.query.filter_by(
                        student_id=student.id,
                        lesson_id=lesson_id
                    ).first()
                    if grade and grade.total_score is not None:
                        dept_grades.append(float(grade.total_score))
                
                if dept_grades:
                    department_averages[dept_name] = {
                        'student_count': len(dept_students),
                        'average_score': sum(dept_grades) / len(dept_grades)
                    }
    
    return jsonify({
        'lesson': lesson.to_dict(),
        'total_students': total_students,
        'students': students_data,
        'teachers': teachers_data,
        'averages': averages,
        'department_averages': department_averages,
        'tests': [t.to_dict() for t in tests]
    }), 200

@dept_head_bp.route('/lessons/<int:lesson_id>/averages', methods=['GET'])
@jwt_required()
@role_required('department_head')
def get_lesson_averages(lesson_id):
    """Dersin bölüm bazında ortalamalarını getir"""
    lesson = Lesson.query.get_or_404(lesson_id)
    
    department_averages = {}
    
    student_role = Role.query.filter_by(name='student').first()
    if student_role:
        departments = db.session.query(User.department).filter(
            User.role_id == student_role.id,
            User.department.isnot(None)
        ).distinct().all()
        
        for dept_tuple in departments:
            dept_name = dept_tuple[0]
            if not dept_name:
                continue
            
            dept_students = db.session.query(User).join(StudentLesson).filter(
                User.department == dept_name,
                StudentLesson.lesson_id == lesson_id,
                User.role_id == student_role.id
            ).all()
            
            if dept_students:
                dept_grades = []
                for student in dept_students:
                    grade = Grade.query.filter_by(
                        student_id=student.id,
                        lesson_id=lesson_id
                    ).first()
                    if grade and grade.total_score is not None:
                        dept_grades.append(float(grade.total_score))
                
                if dept_grades:
                    department_averages[dept_name] = {
                        'student_count': len(dept_students),
                        'average_score': sum(dept_grades) / len(dept_grades),
                        'min_score': min(dept_grades),
                        'max_score': max(dept_grades)
                    }
    
    return jsonify({
        'lesson': lesson.to_dict(),
        'department_averages': department_averages
    }), 200

@dept_head_bp.route('/teachers', methods=['GET'])
@jwt_required()
@role_required('department_head')
def get_all_teachers():
    """Tüm öğretim görevlilerini ve verdikleri dersleri listele"""
    teacher_role = Role.query.filter_by(name='teacher').first()
    if not teacher_role:
        return jsonify({'teachers': []}), 200
    
    teachers = User.query.filter_by(role_id=teacher_role.id).all()
    
    teachers_data = []
    for teacher in teachers:
        teacher_dict = teacher.to_dict()
        
        # Öğretmenin verdiği dersler
        teacher_lessons = TeacherLesson.query.filter_by(teacher_id=teacher.id).all()
        lessons_list = []
        for tl in teacher_lessons:
            lesson = tl.lesson
            # Ders öğrenci sayısı
            student_count = StudentLesson.query.filter_by(lesson_id=lesson.id).count()
            lessons_list.append({
                'id': lesson.id,
                'name': lesson.name,
                'student_count': student_count
            })
        
        teacher_dict['lessons'] = lessons_list
        teacher_dict['lesson_count'] = len(lessons_list)
        teachers_data.append(teacher_dict)
    
    return jsonify({
        'teachers': teachers_data
    }), 200

