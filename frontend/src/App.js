import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Login from './components/Login';
import Register from './components/Register';
import Notes from './components/Notes';
import LandingPage from './components/LandingPage';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (token) {
      try {
        localStorage.setItem('token', token);
        const decodedToken = jwtDecode(token);
        setUsername(decodedToken.user.username);
      } catch (error) {
        console.error("Invalid token");
        setToken(null);
      }
    } else {
      localStorage.removeItem('token');
      setUsername('');
    }
  }, [token]);

  const handleLogout = () => {
    setToken(null);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/notes"
          element={token ? <Notes token={token} username={username} handleLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to={token ? "/notes" : "/"} />} />
      </Routes>
    </Router>
  );
}

export default App;