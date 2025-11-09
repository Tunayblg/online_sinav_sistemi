import React, { useState } from 'react'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'
import TeacherDashboard from './components/TeacherDashboard'
import StudentDashboard from './components/StudentDashboard'
import DepartmentHeadDashboard from './components/DepartmentHeadDashboard'

function App() {
  const [user, setUser] = useState(null)
  
  const handleLoginSuccess = (userData) => {
    setUser(userData)
    console.log('Login başarılı:', userData)
  }
  
  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }
  
  if (!user) {
    return React.createElement(Login, { onLoginSuccess: handleLoginSuccess })
  }
  
  // Admin paneli
  if (user.role_name === 'admin') {
    return React.createElement(AdminDashboard, { 
      user: user, 
      onLogout: handleLogout 
    })
  }
  
  // Teacher paneli
  if (user.role_name === 'teacher') {
    return React.createElement(TeacherDashboard, { 
      user: user, 
      onLogout: handleLogout 
    })
  }
  
  // Student paneli
  if (user.role_name === 'student') {
    return React.createElement(StudentDashboard, { 
      user: user, 
      onLogout: handleLogout 
    })
  }
  
  // Department Head paneli
  if (user.role_name === 'department_head') {
    return React.createElement(DepartmentHeadDashboard, { 
      user: user, 
      onLogout: handleLogout 
    })
  }
  
  // Diğer roller için (şimdilik basit mesaj)
  return React.createElement('div', { className: 'app' },
    React.createElement('h1', null, `Hoş geldiniz, ${user.full_name}!`),
    React.createElement('p', null, `Rol: ${user.role_name}`),
    React.createElement('button', {
      onClick: handleLogout
    }, 'Çıkış Yap')
  )
}

export default App

