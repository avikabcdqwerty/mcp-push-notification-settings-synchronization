import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import NotificationSettingsPage from './pages/NotificationSettingsPage';

/**
 * Main React App entry point.
 * Handles routing and global error boundaries.
 */
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Notification Settings Management Page */}
        <Route path="/settings" element={<NotificationSettingsPage />} />
        {/* Default route: redirect to settings */}
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    </Router>
  );
};

export default App;