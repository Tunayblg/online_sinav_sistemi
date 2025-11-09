"""
Süresi dolmuş sınavlara girmeyen öğrenciler için otomatik 0 notu ekle
Bu script düzenli olarak çalıştırılmalı (örn: her gün)
"""
from app import create_app
from database import db, Test, StudentLesson, TestAttempt, User
from datetime import datetime

def update_missing_exam_scores():
    """Süresi dolmuş sınavlara girmeyen öğrenciler için 0 notu ekle"""
    app = create_app()
    
    with app.app_context():
        # Süresi dolmuş sınavları bul
        now = datetime.now()
        expired_tests = Test.query.filter(Test.end_time < now).all()
        
        updated_count = 0
        
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
                        started_at=test.end_time,  # Sınav bitiş zamanı
                        submitted_at=test.end_time,
                        score=0,
                        status='submitted'
                    )
                    db.session.add(new_attempt)
                    updated_count += 1
                    
                    student = User.query.get(student_id)
                    print(f"✅ {student.full_name} - {test.lesson.name} - {test.test_type.upper()} → 0 puan eklendi")
                
                elif attempt.status != 'submitted':
                    # Başlamış ama tamamlamamış
                    attempt.status = 'submitted'
                    attempt.score = 0
                    attempt.submitted_at = test.end_time
                    updated_count += 1
                    
                    student = User.query.get(student_id)
                    print(f"✅ {student.full_name} - {test.lesson.name} - {test.test_type.upper()} → Tamamlanmamış, 0 puan verildi")
        
        db.session.commit()
        print(f"\n🎯 Toplam {updated_count} öğrenci için otomatik 0 notu eklendi")
        print("✅ Trigger ile notlar otomatik güncellenecek")

if __name__ == '__main__':
    update_missing_exam_scores()

