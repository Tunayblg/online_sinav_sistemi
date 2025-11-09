from flask import Blueprint, request, jsonify
from database import db, User, Role, Lesson, TeacherLesson, StudentLesson, Test, TestAttempt
from utils import role_required, get_current_user, validate_email, validate_password
from flask_jwt_extended import jwt_required
from datetime import datetime

admin_bp = Blueprint('admin', __name__)

def turkish_to_ascii(text):
    """Türkçe karakterleri ASCII'ye çevir"""
    turkish_chars = {
        'ı': 'i', 'İ': 'i',
        'ş': 's', 'Ş': 's',
        'ğ': 'g', 'Ğ': 'g',
        'ü': 'u', 'Ü': 'u',
        'ö': 'o', 'Ö': 'o',
        'ç': 'c', 'Ç': 'c'
    }
    for turkish, ascii_char in turkish_chars.items():
        text = text.replace(turkish, ascii_char)
    return text

def normalize_name(name):
    """İsimleri normalize et - Her kelimenin ilk harfi büyük, diğerleri küçük (Türkçe karakterlerle uyumlu)"""
    if not name:
        return name
    
    # Fazla boşlukları temizle ve kelimelerine ayır
    words = name.strip().split()
    
    # Her kelimenin ilk harfini büyük, diğerlerini küçük yap
    normalized_words = []
    for word in words:
        if len(word) > 0:
            # Türkçe büyük/küçük harf dönüşümü için özel mapping
            first_char = word[0].upper()
            # İ harfi için özel durum
            if word[0].lower() == 'i':
                first_char = 'İ'
            elif word[0].lower() == 'ı':
                first_char = 'I'
            
            rest = word[1:].lower()
            # i harfi için özel durum
            rest = rest.replace('I', 'ı').replace('İ', 'i')
            
            normalized_words.append(first_char + rest)
    
    return ' '.join(normalized_words)

def generate_email_and_password(full_name, role_name, student_number=None):
    """Email ve şifre otomatik oluştur"""
    # İsimleri ayır (boşluklara göre böl)
    names = full_name.strip().split()
    if len(names) < 2:
        return None, None, "Ad ve soyad giriniz"
    
    first_name = names[0]  # İlk isim
    last_name = names[-1]  # Son isim
    
    # Email oluştur
    if role_name == 'student':
        if not student_number:
            return None, None, "Öğrenci numarası gerekli"
        email = f"{student_number}@kocaelisaglik.edu.tr"
    else:
        # Tüm isimleri birleştir ve Türkçe karakterleri ASCII'ye çevir
        all_names_combined = ''.join(names).lower()
        all_names_combined = turkish_to_ascii(all_names_combined)
        email = f"{all_names_combined}@kocaelisaglik.edu.tr"
        
        # Email çakışması varsa ters çevir
        if User.query.filter_by(email=email).first():
            reversed_names = ''.join(reversed(names)).lower()
            reversed_names = turkish_to_ascii(reversed_names)
            email = f"{reversed_names}@kocaelisaglik.edu.tr"
            
            # Hala çakışıyorsa hata
            if User.query.filter_by(email=email).first():
                return None, None, "Bu isimle kullanıcı zaten var, farklı bir isim deneyin"
    
    # Şifre oluştur (baş harfleri ASCII'ye çevir)
    first_initial = turkish_to_ascii(first_name[0].lower())
    last_initial = turkish_to_ascii(last_name[0].lower())
    
    if role_name == 'student':
        # Son 6 hane
        last_six = student_number[-6:] if len(student_number) >= 6 else student_number
        password = f"{first_initial}{last_initial}.{last_six}"
    else:
        # Öğretim üyesi ve bölüm başkanı
        password = f"{first_initial}{last_initial}.123456"
    
    return email, password, None

@admin_bp.route('/users', methods=['POST'])
@jwt_required()
@role_required('admin')
def create_user():
    """Yeni kullanıcı oluştur"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    full_name = data.get('full_name')
    role_name = data.get('role')
    department = data.get('department')
    student_number = data.get('student_number')
    
    if not all([full_name, role_name]):
        return jsonify({'error': 'Full name and role are required'}), 400
    
    # İsmi normalize et (Her kelimenin ilk harfi büyük)
    full_name = normalize_name(full_name)
    
    role = Role.query.filter_by(name=role_name).first()
    if not role:
        return jsonify({'error': 'Invalid role'}), 400
    
    if role_name == 'student':
        if not student_number:
            return jsonify({'error': 'Student number is required for students'}), 400
        if not department:
            return jsonify({'error': 'Department is required for students'}), 400
    
    # Email ve şifre otomatik oluştur
    email, password, error = generate_email_and_password(full_name, role_name, student_number)
    if error:
        return jsonify({'error': error}), 400
    
    # Email çakışma kontrolü
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'error': 'Bu email zaten kullanılıyor'}), 400
    
    user = User(
        email=email,
        full_name=full_name,
        role_id=role.id
    )
    
    # Sadece öğrenci için department ve student_number
    if role_name == 'student':
        user.department = department
        user.student_number = student_number
    
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'message': 'User created successfully',
        'user': user.to_dict(),
        'credentials': {
            'email': email,
            'password': password
        }
    }), 201

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
@role_required('admin')
def get_users():
    """Tüm kullanıcıları listele"""
    users = User.query.all()
    return jsonify({
        'users': [user.to_dict() for user in users]
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
@role_required('admin')
def get_user(user_id):
    """Belirli bir kullanıcıyı getir"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user_dict = user.to_dict()
    
    # Öğretim üyesi ise derslerini ekle
    if user.role.name == 'teacher':
        user_dict['taught_lessons'] = [
            {'lesson_id': tl.lesson_id, 'lesson_name': tl.lesson.name, 'lesson_code': tl.lesson.code}
            for tl in user.taught_lessons
        ]
    
    # Öğrenci ise derslerini ekle
    if user.role.name == 'student':
        user_dict['enrolled_lessons'] = [
            {'lesson_id': sl.lesson_id, 'lesson_name': sl.lesson.name, 'lesson_code': sl.lesson.code}
            for sl in user.enrolled_lessons
        ]
    
    return jsonify({
        'user': user_dict
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
@role_required('admin')
def update_user(user_id):
    """Kullanıcı bilgilerini güncelle"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    full_name = data.get('full_name')
    department = data.get('department')
    lesson_ids = data.get('lesson_ids')
    
    if full_name:
        # İsmi normalize et (Her kelimenin ilk harfi büyük)
        user.full_name = normalize_name(full_name)
    
    if department is not None:
        user.department = department
    
    # Öğretim üyesi için ders ataması
    if user.role.name == 'teacher' and lesson_ids is not None:
        # Önce yeni derslerde çakışma var mı kontrol et
        for lesson_id in lesson_ids:
            lesson = Lesson.query.get(lesson_id)
            if lesson:
                # Bu derse zaten başka bir öğretmen atanmış mı kontrol et
                existing_assignment = TeacherLesson.query.filter_by(lesson_id=lesson_id).first()
                if existing_assignment and existing_assignment.teacher_id != user_id:
                    existing_teacher = User.query.get(existing_assignment.teacher_id)
                    if existing_teacher:
                        return jsonify({
                            'error': f'{lesson.name} dersini {existing_teacher.full_name} veriyor. Bir derse sadece bir öğretim görevlisi atanabilir.'
                        }), 400
        
        # Önce mevcut dersleri kaldır
        TeacherLesson.query.filter_by(teacher_id=user_id).delete()
        
        # Yeni dersleri ekle
        for lesson_id in lesson_ids:
            lesson = Lesson.query.get(lesson_id)
            if lesson:
                teacher_lesson = TeacherLesson(
                    teacher_id=user_id,
                    lesson_id=lesson_id
                )
                db.session.add(teacher_lesson)
    
    # Öğrenci için ders ataması
    if user.role.name == 'student' and lesson_ids is not None:
        # Önce mevcut dersleri kaldır
        StudentLesson.query.filter_by(student_id=user_id).delete()
        
        # Yeni dersleri ekle
        for lesson_id in lesson_ids:
            lesson = Lesson.query.get(lesson_id)
            if lesson:
                student_lesson = StudentLesson(
                    student_id=user_id,
                    lesson_id=lesson_id
                )
                db.session.add(student_lesson)
    
    db.session.commit()
    
    return jsonify({
        'message': 'User updated successfully',
        'user': user.to_dict()
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@role_required('admin')
def delete_user(user_id):
    """Kullanıcıyı sil"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User deleted successfully'}), 200

@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@jwt_required()
@role_required('admin')
def reset_user_password(user_id):
    """Kullanıcının şifresini sıfırla"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Sadece öğretim üyesi ve bölüm başkanı için
    if user.role.name not in ['teacher', 'department_head']:
        return jsonify({'error': 'Password reset only available for teachers and department heads'}), 400
    
    # Yeni şifre oluştur (Türkçe karakterleri ASCII'ye çevir)
    names = user.full_name.strip().split()
    if len(names) < 2:
        return jsonify({'error': 'Invalid user name format'}), 400
    
    first_initial = turkish_to_ascii(names[0][0].lower())
    last_initial = turkish_to_ascii(names[-1][0].lower())
    new_password = f"{first_initial}{last_initial}.123456"
    
    # Şifreyi güncelle
    user.set_password(new_password)
    db.session.commit()
    
    return jsonify({
        'message': 'Password reset successfully',
        'new_password': new_password
    }), 200

@admin_bp.route('/lessons', methods=['POST'])
@jwt_required()
@role_required('admin')
def create_lesson():
    """Yeni ders oluştur"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    code = data.get('code')
    name = data.get('name')
    
    if not code or not name:
        return jsonify({'error': 'Code and name are required'}), 400
    
    existing_lesson = Lesson.query.filter_by(code=code).first()
    if existing_lesson:
        return jsonify({'error': 'Lesson code already exists'}), 400
    
    lesson = Lesson(
        code=code,
        name=name
    )
    
    db.session.add(lesson)
    db.session.commit()
    
    return jsonify({
        'message': 'Lesson created successfully',
        'lesson': lesson.to_dict()
    }), 201

@admin_bp.route('/lessons', methods=['GET'])
@jwt_required()
@role_required('admin')
def get_lessons():
    """Tüm dersleri listele"""
    lessons = Lesson.query.all()
    return jsonify({
        'lessons': [lesson.to_dict() for lesson in lessons]
    }), 200

@admin_bp.route('/lessons/<int:lesson_id>', methods=['GET'])
@jwt_required()
@role_required('admin')
def get_lesson_detail(lesson_id):
    """Ders detaylarını getir (öğretmenler, kayıtlı öğrenciler, atanmamış öğrenciler)"""
    lesson = Lesson.query.get_or_404(lesson_id)
    
    teacher_lessons = TeacherLesson.query.filter_by(lesson_id=lesson_id).all()
    teachers = [tl.teacher.to_dict() for tl in teacher_lessons]
    
    student_lessons = StudentLesson.query.filter_by(lesson_id=lesson_id).all()
    enrolled_students = [sl.student.to_dict() for sl in student_lessons]
    
    student_role = Role.query.filter_by(name='student').first()
    if student_role:
        all_students = User.query.filter_by(role_id=student_role.id).all()
        enrolled_student_ids = [sl.student_id for sl in student_lessons]
        unassigned_students = [s.to_dict() for s in all_students if s.id not in enrolled_student_ids]
    else:
        unassigned_students = []
    
    teacher_role = Role.query.filter_by(name='teacher').first()
    if teacher_role:
        all_teachers = User.query.filter_by(role_id=teacher_role.id).all()
        assigned_teacher_ids = [tl.teacher_id for tl in teacher_lessons]
        unassigned_teachers = [t.to_dict() for t in all_teachers if t.id not in assigned_teacher_ids]
    else:
        unassigned_teachers = []
    
    return jsonify({
        'lesson': lesson.to_dict(),
        'teachers': teachers,
        'enrolled_students': enrolled_students,
        'unassigned_students': unassigned_students,
        'unassigned_teachers': unassigned_teachers
    }), 200

@admin_bp.route('/lessons/<int:lesson_id>', methods=['PUT'])
@jwt_required()
@role_required('admin')
def update_lesson(lesson_id):
    """Ders bilgilerini güncelle ve öğretmen/öğrenci ata"""
    lesson = Lesson.query.get_or_404(lesson_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    code = data.get('code')
    name = data.get('name')
    teacher_id = data.get('teacher_id')
    student_ids = data.get('student_ids', [])
    
    # Ders adı ve kodu güncelle
    if code and code != lesson.code:
        existing_lesson = Lesson.query.filter_by(code=code).first()
        if existing_lesson:
            return jsonify({'error': 'Lesson code already exists'}), 400
        lesson.code = code
    
    if name:
        lesson.name = name
    
    # Öğretmen ata (bir dersin sadece bir öğretmeni olacak)
    if teacher_id is not None:
        # teacher_id'yi integer'a çevir ve validasyon yap
        try:
            teacher_id_int = int(teacher_id) if teacher_id != '' else 0
        except (ValueError, TypeError):
            return jsonify({'error': 'Geçersiz öğretmen seçimi'}), 400
        
        if teacher_id_int > 0:  # 0 değilse yeni öğretmen atama kontrolü yap
            # Bu derse zaten başka bir öğretmen atanmış mı kontrol et
            existing_assignment = TeacherLesson.query.filter_by(lesson_id=lesson_id).first()
            if existing_assignment and existing_assignment.teacher_id != teacher_id_int:
                existing_teacher = User.query.get(existing_assignment.teacher_id)
                if existing_teacher:
                    return jsonify({
                        'error': f'Bu dersi {existing_teacher.full_name} veriyor. Bir derse sadece bir öğretim görevlisi atanabilir.'
                    }), 400
        
        # Önce mevcut öğretmeni kaldır
        TeacherLesson.query.filter_by(lesson_id=lesson_id).delete()
        
        if teacher_id_int > 0:  # 0 ise öğretmen kaldır
            teacher = User.query.get(teacher_id_int)
            if not teacher or teacher.role.name != 'teacher':
                return jsonify({'error': 'Seçilen öğretmen bulunamadı veya geçersiz'}), 400
            
            teacher_lesson = TeacherLesson(
                teacher_id=teacher_id_int,
                lesson_id=lesson_id
            )
            db.session.add(teacher_lesson)
    
    # Öğrencileri ata
    if student_ids is not None:
        # Önce mevcut öğrencileri kaldır
        StudentLesson.query.filter_by(lesson_id=lesson_id).delete()
        
        # Yeni öğrencileri ekle
        for student_id in student_ids:
            student = User.query.get(student_id)
            if student and student.role.name == 'student':
                student_lesson = StudentLesson(
                    student_id=student_id,
                    lesson_id=lesson_id
                )
                db.session.add(student_lesson)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Lesson updated successfully',
        'lesson': lesson.to_dict()
    }), 200

@admin_bp.route('/lessons/<int:lesson_id>', methods=['DELETE'])
@jwt_required()
@role_required('admin')
def delete_lesson(lesson_id):
    """Ders sil"""
    lesson = Lesson.query.get(lesson_id)
    if not lesson:
        return jsonify({'error': 'Lesson not found'}), 404
    
    db.session.delete(lesson)
    db.session.commit()
    
    return jsonify({'message': 'Lesson deleted successfully'}), 200

@admin_bp.route('/assign-teacher', methods=['POST'])
@jwt_required()
@role_required('admin')
def assign_teacher():
    """Öğretmene ders ata"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    teacher_id = data.get('teacher_id')
    lesson_id = data.get('lesson_id')
    
    if not teacher_id or not lesson_id:
        return jsonify({'error': 'Teacher ID and Lesson ID are required'}), 400
    
    teacher = User.query.get(teacher_id)
    if not teacher or teacher.role.name != 'teacher':
        return jsonify({'error': 'Invalid teacher'}), 400
    
    lesson = Lesson.query.get(lesson_id)
    if not lesson:
        return jsonify({'error': 'Lesson not found'}), 404
    
    # Bu derse zaten başka bir öğretmen atanmış mı kontrol et
    existing_assignment = TeacherLesson.query.filter_by(lesson_id=lesson_id).first()
    if existing_assignment:
        existing_teacher = User.query.get(existing_assignment.teacher_id)
        if existing_teacher:
            return jsonify({
                'error': f'Bu dersi {existing_teacher.full_name} veriyor. Bir derse sadece bir öğretim görevlisi atanabilir.'
            }), 400
    
    existing = TeacherLesson.query.filter_by(
        teacher_id=teacher_id,
        lesson_id=lesson_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Teacher already assigned to this lesson'}), 400
    
    assignment = TeacherLesson(
        teacher_id=teacher_id,
        lesson_id=lesson_id
    )
    
    db.session.add(assignment)
    db.session.commit()
    
    return jsonify({
        'message': 'Teacher assigned successfully',
        'assignment': assignment.to_dict()
    }), 201

@admin_bp.route('/assign-student', methods=['POST'])
@jwt_required()
@role_required('admin')
def assign_student():
    """Öğrenciye ders ata"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    student_id = data.get('student_id')
    lesson_id = data.get('lesson_id')
    
    if not student_id or not lesson_id:
        return jsonify({'error': 'Student ID and Lesson ID are required'}), 400
    
    student = User.query.get(student_id)
    if not student or student.role.name != 'student':
        return jsonify({'error': 'Invalid student'}), 400
    
    lesson = Lesson.query.get(lesson_id)
    if not lesson:
        return jsonify({'error': 'Lesson not found'}), 404
    
    existing = StudentLesson.query.filter_by(
        student_id=student_id,
        lesson_id=lesson_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Student already assigned to this lesson'}), 400
    
    assignment = StudentLesson(
        student_id=student_id,
        lesson_id=lesson_id
    )
    
    db.session.add(assignment)
    db.session.commit()
    
    return jsonify({
        'message': 'Student assigned successfully',
        'assignment': assignment.to_dict()
    }), 201

def normalize_department(dept_name):
    """Bölüm adını normalize et (büyük/küçük harf ve Türkçe karakter uyumlu)"""
    # Kabul edilen bölümler
    valid_departments = {
        'bilgisayar mühendisliği': 'Bilgisayar Mühendisliği',
        'bilgisayar muhendisligi': 'Bilgisayar Mühendisliği',
        'yazılım mühendisliği': 'Yazılım Mühendisliği',
        'yazilim muhendisligi': 'Yazılım Mühendisliği',
        'psikoloji': 'Psikoloji',
        'diş hekimliği': 'Diş Hekimliği',
        'dis hekimligi': 'Diş Hekimliği',
        'eczacılık': 'Eczacılık',
        'eczacilik': 'Eczacılık'
    }
    
    # Küçük harfe çevir ve normalize et
    normalized = dept_name.lower().strip()
    
    # Eşleşmeyi bul
    for key, value in valid_departments.items():
        if key in normalized or normalized in key:
            return value
    
    # Eşleşme yoksa orijinali döndür (ama uyarı için None döndürebiliriz)
    return None

@admin_bp.route('/users/bulk-upload', methods=['POST'])
@jwt_required()
@role_required('admin')
def bulk_upload_students():
    """Excel'den toplu öğrenci yükleme"""
    data = request.get_json()
    students_data = data.get('students', [])
    
    if not students_data:
        return jsonify({'error': 'Öğrenci verisi bulunamadı'}), 400
    
    results = {
        'created': [],
        'updated': [],
        'errors': []
    }
    
    student_role = Role.query.filter_by(name='student').first()
    if not student_role:
        return jsonify({'error': 'Student role not found'}), 500
    
    for idx, student in enumerate(students_data, start=2):  # Excel'de 2. satırdan başlar (1. satır başlık)
        try:
            student_number = str(student.get('student_number', '')).strip()
            first_name = str(student.get('first_name', '')).strip()
            last_name = str(student.get('last_name', '')).strip()
            department = str(student.get('department', '')).strip()
            
            # Validasyon
            if not student_number:
                results['errors'].append({
                    'row': idx,
                    'error': 'Öğrenci numarası boş olamaz',
                    'data': student
                })
                continue
            
            if not first_name or not last_name:
                results['errors'].append({
                    'row': idx,
                    'error': 'İsim veya soyad boş olamaz',
                    'data': student
                })
                continue
            
            if not department:
                results['errors'].append({
                    'row': idx,
                    'error': 'Bölüm boş olamaz',
                    'data': student
                })
                continue
            
            # Bölüm adını normalize et
            normalized_department = normalize_department(department)
            if not normalized_department:
                results['errors'].append({
                    'row': idx,
                    'error': f'Geçersiz bölüm: "{department}". Kabul edilen: Bilgisayar Mühendisliği, Yazılım Mühendisliği, Psikoloji, Diş Hekimliği, Eczacılık',
                    'data': student
                })
                continue
            
            # İsmi normalize et (Her kelimenin ilk harfi büyük)
            first_name_normalized = normalize_name(first_name)
            last_name_normalized = normalize_name(last_name)
            full_name = f"{first_name_normalized} {last_name_normalized}"
            
            # Öğrenci numarasına göre kontrol et
            existing_user = User.query.filter_by(student_number=student_number).first()
            
            if existing_user:
                # Zaten var, hata olarak raporla
                results['errors'].append({
                    'row': idx,
                    'error': f'Bu öğrenci numarası ({student_number}) zaten kayıtlı: {existing_user.full_name}',
                    'data': student
                })
                continue
            
            # Email zaten kullanımda mı kontrol et
            email, password, error = generate_email_and_password(full_name, 'student', student_number)
            if error:
                results['errors'].append({
                    'row': idx,
                    'error': error,
                    'data': student
                })
                continue
            
            if User.query.filter_by(email=email).first():
                results['errors'].append({
                    'row': idx,
                    'error': f'Bu email ({email}) zaten kullanımda',
                    'data': student
                })
                continue
            
            # Yeni öğrenci oluştur
            new_user = User(
                email=email,
                full_name=full_name,
                role_id=student_role.id,
                department=normalized_department,
                student_number=student_number
            )
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.commit()
            
            results['created'].append({
                'row': idx,
                'student_number': student_number,
                'full_name': full_name,
                'email': email,
                'password': password,
                'department': normalized_department
            })
        
        except Exception as e:
            db.session.rollback()
            results['errors'].append({
                'row': idx,
                'error': str(e),
                'data': student
            })
    
    return jsonify({
        'message': 'Toplu yükleme tamamlandı',
        'summary': {
            'created_count': len(results['created']),
            'updated_count': len(results['updated']),
            'error_count': len(results['errors'])
        },
        'results': results
    }), 200

@admin_bp.route('/lessons/bulk-upload', methods=['POST'])
@jwt_required()
@role_required('admin')
def bulk_upload_lessons():
    """Excel'den toplu ders yükleme"""
    data = request.get_json()
    lessons_data = data.get('lessons', [])
    
    if not lessons_data:
        return jsonify({'error': 'Ders verisi bulunamadı'}), 400
    
    results = {
        'created': [],
        'updated': [],
        'errors': []
    }
    
    for idx, lesson in enumerate(lessons_data, start=2):  # Excel'de 2. satırdan başlar
        try:
            name = str(lesson.get('name', '')).strip()
            code = str(lesson.get('code', '')).strip()
            
            # Validasyon
            if not name:
                results['errors'].append({
                    'row': idx,
                    'error': 'Ders adı boş olamaz',
                    'data': lesson
                })
                continue
            
            if not code:
                results['errors'].append({
                    'row': idx,
                    'error': 'Ders kodu boş olamaz',
                    'data': lesson
                })
                continue
            
            # Ders koduna göre kontrol et
            existing_lesson = Lesson.query.filter_by(code=code).first()
            
            if existing_lesson:
                # Güncelle
                existing_lesson.name = name
                db.session.commit()
                
                results['updated'].append({
                    'row': idx,
                    'code': code,
                    'name': name
                })
            else:
                # Yeni oluştur
                new_lesson = Lesson(
                    code=code,
                    name=name
                )
                db.session.add(new_lesson)
                db.session.commit()
                
                results['created'].append({
                    'row': idx,
                    'code': code,
                    'name': name
                })
        
        except Exception as e:
            db.session.rollback()
            results['errors'].append({
                'row': idx,
                'error': str(e),
                'data': lesson
            })
    
    return jsonify({
        'message': 'Toplu ders yükleme tamamlandı',
        'summary': {
            'created_count': len(results['created']),
            'updated_count': len(results['updated']),
            'error_count': len(results['errors'])
        },
        'results': results
    }), 200

@admin_bp.route('/update-missing-scores', methods=['POST'])
@jwt_required()
@role_required('admin')
def update_missing_exam_scores():
    """Süresi dolmuş sınavlara girmeyen öğrenciler için otomatik 0 notu ekle"""
    try:
        # Süresi dolmuş sınavları bul
        now = datetime.now()
        expired_tests = Test.query.filter(Test.end_time < now).all()
        
        updated_count = 0
        updated_students = []
        
        for test in expired_tests:
            # Bu derse kayıtlı öğrencileri bul
            student_lessons = StudentLesson.query.filter_by(lesson_id=test.lesson_id).all()
            
            for sl in student_lessons:
                student_id = sl.student_id
                
                # Öğrenci bu sınava girmiş mi kontrol et
                attempt = TestAttempt.query.filter_by(
                    student_id=student_id,
                    test_id=test.id
                ).first()
                
                # Girmediyse veya tamamlamadıysa 0 ver
                if not attempt:
                    # Yeni TestAttempt oluştur (0 puan)
                    new_attempt = TestAttempt(
                        student_id=student_id,
                        test_id=test.id,
                        started_at=test.end_time,
                        submitted_at=test.end_time,
                        score=0,
                        status='submitted'
                    )
                    db.session.add(new_attempt)
                    updated_count += 1
                    
                    student = User.query.get(student_id)
                    updated_students.append({
                        'student_name': student.full_name,
                        'lesson_name': test.lesson.name,
                        'test_type': test.test_type.upper(),
                        'score': 0,
                        'reason': 'Sınava girmedi'
                    })
                
                elif attempt.status != 'submitted':
                    # Başlamış ama tamamlamamış
                    attempt.status = 'submitted'
                    attempt.score = 0
                    attempt.submitted_at = test.end_time
                    updated_count += 1
                    
                    student = User.query.get(student_id)
                    updated_students.append({
                        'student_name': student.full_name,
                        'lesson_name': test.lesson.name,
                        'test_type': test.test_type.upper(),
                        'score': 0,
                        'reason': 'Sınavı tamamlamadı'
                    })
        
        db.session.commit()
        
        return jsonify({
            'message': f'Toplam {updated_count} öğrenci için otomatik 0 notu eklendi',
            'updated_count': updated_count,
            'updated_students': updated_students
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

