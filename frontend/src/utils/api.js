// API helper fonksiyonları - Backend ile iletişim

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'

// Token'ları localStorage'dan al
function getAccessToken() {
  return localStorage.getItem('access_token')
}

function getRefreshToken() {
  return localStorage.getItem('refresh_token')
}

// Token'ları localStorage'a kaydet
function setTokens(accessToken, refreshToken) {
  localStorage.setItem('access_token', accessToken)
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken)
  }
}

// Token'ları sil (logout)
function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// API isteği yap (token otomatik eklenir)
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const token = getAccessToken()
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const config = {
    ...options,
    headers
  }
  
  try {
    const response = await fetch(url, config)
    const data = await response.json()
    
    // Token süresi dolmuşsa refresh dene
    if (response.status === 401 && token) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        // Token yenilendi, isteği tekrar yap
        const newToken = getAccessToken()
        headers['Authorization'] = `Bearer ${newToken}`
        const retryResponse = await fetch(url, { ...config, headers })
        return await retryResponse.json()
      } else {
        // Refresh başarısız, logout
        clearTokens()
        window.location.href = '/login'
        throw new Error('Session expired')
      }
    }
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed')
    }
    
    return data
  } catch (error) {
    throw error
  }
}

// Access token'ı yenile
async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return false
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`
      }
    })
    
    if (!response.ok) {
      return false
    }
    
    const data = await response.json()
    setTokens(data.access_token, null) // Refresh token aynı kalır
    return true
  } catch (error) {
    return false
  }
}

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed')
    }
    
    // Token'ları kaydet
    setTokens(data.access_token, data.refresh_token)
    
    return data
  },
  
  logout: () => {
    clearTokens()
  },
  
  getCurrentUser: async () => {
    return await apiRequest('/auth/me')
  }
}

// Diğer API fonksiyonları buraya eklenecek (admin, teacher, student, department_head)

export { apiRequest, getAccessToken, clearTokens, API_BASE_URL }
