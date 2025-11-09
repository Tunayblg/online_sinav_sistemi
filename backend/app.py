from flask import Flask
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
from pathlib import Path
from database import db
from init import init_database

# Environment variables yükle
# Önce backend klasöründeki .env'i dene, yoksa kök dizindekini kullan
env_path = Path(__file__).parent / '.env'
if not env_path.exists():
    env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

migrate = Migrate()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    
    # Config
    db_url = os.getenv('DB_URL')
    if not db_url:
        # .env dosyasını tekrar yükle
        env_path = Path(__file__).parent / '.env'
        if not env_path.exists():
            env_path = Path(__file__).parent.parent / '.env'
        load_dotenv(dotenv_path=env_path)
        db_url = os.getenv('DB_URL')
    
    if not db_url:
        raise RuntimeError(f"DB_URL not found! Checked: {env_path}")
    
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = int(os.getenv('JWT_ACCESS_EXPIRES', 3600))
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = int(os.getenv('JWT_REFRESH_EXPIRES', 604800))
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    
    # CORS için (frontend ile iletişim)
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    # Blueprint'leri kaydet
    from auth import auth_bp
    from admin import admin_bp
    from teacher import teacher_bp
    from student import student_bp
    from department_head import dept_head_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(teacher_bp, url_prefix='/api/teacher')
    app.register_blueprint(student_bp, url_prefix='/api/student')
    app.register_blueprint(dept_head_bp, url_prefix='/api/department-head')
    
    return app

if __name__ == '__main__':
    app = create_app()
    
    # Veritabanını başlat
    init_database(app)
    
    port = int(os.getenv('SERVER_PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)

