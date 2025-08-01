import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1>Yash Sticky Notes</h1>
        <p>Your personal space to capture thoughts, ideas, and inspiration.</p>
        <div className="landing-actions">
          <Link to="/login" className="btn-landing">Login</Link>
          <Link to="/register" className="btn-landing">Register</Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
