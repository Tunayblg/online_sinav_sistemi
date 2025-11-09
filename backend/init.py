from database import db, Role, User
from sqlalchemy import text

def init_database(app):
    """Veritabanı tablolarını oluşturur, rolleri ekler ve trigger'ları oluşturur"""
    with app.app_context():
        # Tüm tabloları oluştur (database.py'deki tüm modeller)
        # NOT: Eğer tablo zaten varsa, db.create_all() hiçbir şey yapmaz (DROP etmez)
        db.create_all()
        
        # Rolleri oluştur
        roles = ['admin', 'teacher', 'student', 'department_head']
        for role_name in roles:
            role = Role.query.filter_by(name=role_name).first()
            if not role:
                role = Role(name=role_name)
                db.session.add(role)
        
        db.session.commit()
        
        # Default admin kullanıcısı ekle
        admin_email = 'admin@test.com'
        if not User.query.filter_by(email=admin_email).first():
            admin_role = Role.query.filter_by(name='admin').first()
            admin_user = User(
                email=admin_email,
                full_name='Admin User',
                role_id=admin_role.id
            )
            admin_user.set_password('admin123')
            db.session.add(admin_user)
            db.session.commit()
            print(f"✓ Default admin created: {admin_email} / admin123")
        
        # Trigger'ları oluştur (init.sql'deki trigger'lar)
        try:
            # Trigger: updated_at otomatik güncelleme
            db.session.execute(text("""
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
            """))
            
            # Users tablosu için trigger
            db.session.execute(text("""
                DROP TRIGGER IF EXISTS update_users_updated_at ON users;
                CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            """))
            
            # Grades tablosu için trigger
            db.session.execute(text("""
                DROP TRIGGER IF EXISTS update_grades_updated_at ON grades;
                CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON grades
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            """))
            
            # Trigger: Öğrencinin derse kayıtlı olup olmadığını kontrol et
            db.session.execute(text("""
                CREATE OR REPLACE FUNCTION check_student_enrollment()
                RETURNS TRIGGER AS $$
                DECLARE
                    lesson_id_val INTEGER;
                    enrollment_exists BOOLEAN;
                BEGIN
                    SELECT lesson_id INTO lesson_id_val
                    FROM tests
                    WHERE id = NEW.test_id;
                    
                    SELECT EXISTS(
                        SELECT 1
                        FROM student_lesson
                        WHERE student_id = NEW.student_id
                        AND lesson_id = lesson_id_val
                    ) INTO enrollment_exists;
                    
                    IF NOT enrollment_exists THEN
                        RAISE EXCEPTION 'Student % is not enrolled in the lesson for test %', NEW.student_id, NEW.test_id;
                    END IF;
                    
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
            """))
            
            db.session.execute(text("""
                DROP TRIGGER IF EXISTS check_student_enrollment_before_insert ON test_attempts;
                CREATE TRIGGER check_student_enrollment_before_insert
                    BEFORE INSERT ON test_attempts
                    FOR EACH ROW
                    EXECUTE FUNCTION check_student_enrollment();
            """))
            
            # Trigger: Öğretmenin derse atanmış olup olmadığını kontrol et
            db.session.execute(text("""
                CREATE OR REPLACE FUNCTION check_teacher_assignment()
                RETURNS TRIGGER AS $$
                DECLARE
                    assignment_exists BOOLEAN;
                BEGIN
                    SELECT EXISTS(
                        SELECT 1
                        FROM teacher_lesson
                        WHERE teacher_id = NEW.teacher_id
                        AND lesson_id = NEW.lesson_id
                    ) INTO assignment_exists;
                    
                    IF NOT assignment_exists THEN
                        RAISE EXCEPTION 'Teacher % is not assigned to lesson %', NEW.teacher_id, NEW.lesson_id;
                    END IF;
                    
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
            """))
            
            db.session.execute(text("""
                DROP TRIGGER IF EXISTS check_teacher_assignment_before_insert ON tests;
                CREATE TRIGGER check_teacher_assignment_before_insert
                    BEFORE INSERT ON tests
                    FOR EACH ROW
                    EXECUTE FUNCTION check_teacher_assignment();
            """))
            
            db.session.commit()
            print("Database initialized successfully with all tables, constraints, and triggers!")
            
        except Exception as e:
            print(f"Warning: Could not create triggers: {e}")
            print("Tables and roles created, but triggers may need to be created manually.")
            db.session.rollback()

