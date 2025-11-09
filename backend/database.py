from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import CheckConstraint
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class Role(db.Model):
    __tablename__ = 'roles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    users = db.relationship('User', backref='role', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    department = db.Column(db.String(255), nullable=True)
    student_number = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    taught_lessons = db.relationship('TeacherLesson', backref='teacher', lazy=True, cascade='all, delete-orphan')
    enrolled_lessons = db.relationship('StudentLesson', backref='student', lazy=True, cascade='all, delete-orphan')
    created_tests = db.relationship('Test', backref='teacher', lazy=True)
    test_attempts = db.relationship('TestAttempt', backref='student', lazy=True)
    grades = db.relationship('Grade', backref='student', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'role_id': self.role_id,
            'role_name': self.role.name if self.role else None,
            'department': self.department,
            'student_number': self.student_number,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Lesson(db.Model):
    __tablename__ = 'lessons'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    vize_weight = db.Column(db.Numeric(5, 2), default=40.00, nullable=False)
    final_weight = db.Column(db.Numeric(5, 2), default=60.00, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    teachers = db.relationship('TeacherLesson', backref='lesson', lazy=True, cascade='all, delete-orphan')
    students = db.relationship('StudentLesson', backref='lesson', lazy=True, cascade='all, delete-orphan')
    tests = db.relationship('Test', backref='lesson', lazy=True, cascade='all, delete-orphan')
    grades = db.relationship('Grade', backref='lesson', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        # Öğretmeni bul
        teacher = None
        if self.teachers:
            teacher_lesson = self.teachers[0]
            teacher_user = User.query.get(teacher_lesson.teacher_id)
            if teacher_user:
                teacher = {
                    'id': teacher_user.id,
                    'full_name': teacher_user.full_name,
                    'email': teacher_user.email
                }
        
        # Öğrencileri bul
        students = []
        for student_lesson in self.students:
            student_user = User.query.get(student_lesson.student_id)
            if student_user:
                students.append({
                    'id': student_user.id,
                    'full_name': student_user.full_name,
                    'email': student_user.email,
                    'student_number': student_user.student_number
                })
        
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'vize_weight': float(self.vize_weight) if self.vize_weight else 40.00,
            'final_weight': float(self.final_weight) if self.final_weight else 60.00,
            'teacher': teacher,
            'students': students,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class TeacherLesson(db.Model):
    __tablename__ = 'teacher_lesson'
    
    id = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('teacher_id', 'lesson_id', name='unique_teacher_lesson'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'teacher_id': self.teacher_id,
            'lesson_id': self.lesson_id,
            'teacher': self.teacher.to_dict() if self.teacher else None,
            'lesson': self.lesson.to_dict() if self.lesson else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class StudentLesson(db.Model):
    __tablename__ = 'student_lesson'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('student_id', 'lesson_id', name='unique_student_lesson'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'lesson_id': self.lesson_id,
            'student': self.student.to_dict() if self.student else None,
            'lesson': self.lesson.to_dict() if self.lesson else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Test(db.Model):
    __tablename__ = 'tests'
    
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    test_type = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    min_questions = db.Column(db.Integer, default=5, nullable=False)
    vize_weight = db.Column(db.Numeric(5, 2), default=40.00)
    final_weight = db.Column(db.Numeric(5, 2), default=60.00)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    questions = db.relationship('Question', backref='test', lazy=True, cascade='all, delete-orphan', order_by='Question.id')
    attempts = db.relationship('TestAttempt', backref='test', lazy=True, cascade='all, delete-orphan')
    
    __table_args__ = (
        CheckConstraint("test_type IN ('vize', 'final', 'quiz')", name='check_test_type'),
        CheckConstraint('end_time > start_time', name='check_time_range'),
        CheckConstraint('vize_weight + final_weight = 100.00', name='check_weights_sum'),
        CheckConstraint('duration > 0', name='check_duration_positive'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'lesson_id': self.lesson_id,
            'teacher_id': self.teacher_id,
            'test_type': self.test_type,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration': self.duration,
            'min_questions': self.min_questions,
            'vize_weight': float(self.vize_weight) if self.vize_weight else None,
            'final_weight': float(self.final_weight) if self.final_weight else None,
            'lesson': self.lesson.to_dict() if self.lesson else None,
            'teacher': self.teacher.to_dict() if self.teacher else None,
            'question_count': len(self.questions),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Question(db.Model):
    __tablename__ = 'questions'
    
    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey('tests.id'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    option_a = db.Column(db.Text, nullable=False)
    option_b = db.Column(db.Text, nullable=False)
    option_c = db.Column(db.Text, nullable=False)
    option_d = db.Column(db.Text, nullable=False)
    correct_answer = db.Column(db.String(1), nullable=False)
    points = db.Column(db.Integer, default=10)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    answers = db.relationship('Answer', backref='question', lazy=True, cascade='all, delete-orphan')
    
    __table_args__ = (
        CheckConstraint("correct_answer IN ('a', 'b', 'c', 'd')", name='check_correct_answer'),
    )
    
    def to_dict(self, include_correct=False):
        data = {
            'id': self.id,
            'test_id': self.test_id,
            'question_text': self.question_text,
            'option_a': self.option_a,
            'option_b': self.option_b,
            'option_c': self.option_c,
            'option_d': self.option_d,
            'points': self.points,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_correct:
            data['correct_answer'] = self.correct_answer
        return data

class TestAttempt(db.Model):
    __tablename__ = 'test_attempts'
    
    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey('tests.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    started_at = db.Column(db.DateTime, nullable=False)
    submitted_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='started')
    score = db.Column(db.Numeric(10, 2), default=0.00)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    answers = db.relationship('Answer', backref='attempt', lazy=True, cascade='all, delete-orphan')
    
    __table_args__ = (
        db.UniqueConstraint('test_id', 'student_id', name='unique_test_student'),
        CheckConstraint("status IN ('started', 'submitted', 'expired')", name='check_status'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'test_id': self.test_id,
            'student_id': self.student_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'status': self.status,
            'score': float(self.score) if self.score else 0.00,
            'test': self.test.to_dict() if self.test else None,
            'student': self.student.to_dict() if self.student else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Answer(db.Model):
    __tablename__ = 'answers'
    
    id = db.Column(db.Integer, primary_key=True)
    attempt_id = db.Column(db.Integer, db.ForeignKey('test_attempts.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    selected_answer = db.Column(db.String(1))
    is_correct = db.Column(db.Boolean, default=False)
    points_earned = db.Column(db.Numeric(10, 2), default=0.00)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('attempt_id', 'question_id', name='unique_attempt_question'),
        CheckConstraint("selected_answer IS NULL OR selected_answer IN ('a', 'b', 'c', 'd')", name='check_selected_answer'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'attempt_id': self.attempt_id,
            'question_id': self.question_id,
            'selected_answer': self.selected_answer,
            'is_correct': self.is_correct,
            'points_earned': float(self.points_earned) if self.points_earned else 0.00,
            'question': self.question.to_dict(include_correct=True) if self.question else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Grade(db.Model):
    __tablename__ = 'grades'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False)
    vize_score = db.Column(db.Numeric(10, 2), nullable=True)
    final_score = db.Column(db.Numeric(10, 2), nullable=True)
    quiz_score = db.Column(db.Numeric(10, 2), nullable=True)
    total_score = db.Column(db.Numeric(10, 2), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('student_id', 'lesson_id', name='unique_student_lesson_grade'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'lesson_id': self.lesson_id,
            'vize_score': float(self.vize_score) if self.vize_score else None,
            'final_score': float(self.final_score) if self.final_score else None,
            'quiz_score': float(self.quiz_score) if self.quiz_score else None,
            'total_score': float(self.total_score) if self.total_score else None,
            'student': self.student.to_dict() if self.student else None,
            'lesson': self.lesson.to_dict() if self.lesson else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
