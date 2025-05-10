import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

// Components
import Navbar from './components/layout/Navbar';
import Landing from './components/layout/Landing';
import Register from './components/auth/Register';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import GroupDetail from './components/groups/GroupDetail';
import CreateGroup from './components/groups/CreateGroup';
import AddExpense from './components/expenses/AddExpense';
import SettlementPlan from './components/expenses/SettlementPlan';
import ExpenseAnalysis from './components/expenses/ExpenseAnalysis';

// Context
import AuthContext from './context/AuthContext';

// Set default axios base URL
axios.defaults.baseURL = 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Load user on initial render
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');

      if (token) {
        // Set auth token header
        axios.defaults.headers.common['x-auth-token'] = token;

        try {
          const res = await axios.get('/users/profile');
          setUser(res.data);
          setIsAuthenticated(true);

          // Connect to socket
          const socketInstance = io('http://localhost:5000');
          setSocket(socketInstance);
        } catch (err) {
          console.error('Error loading user:', err);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['x-auth-token'];
        }
      }

      setLoading(false);
    };

    loadUser();

    // Cleanup socket connection
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Private route component
  const PrivateRoute = ({ children }) => {
    if (loading) return <div>Loading...</div>;
    return isAuthenticated ? children : <Navigate to="/login" />;
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, setUser, setIsAuthenticated, socket }}>
      <Router>
        <div className="App">
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            <Route path="/groups/create" element={
              <PrivateRoute>
                <CreateGroup />
              </PrivateRoute>
            } />
            <Route path="/groups/:id" element={
              <PrivateRoute>
                <GroupDetail />
              </PrivateRoute>
            } />
            <Route path="/expenses/add/:groupId" element={
              <PrivateRoute>
                <AddExpense />
              </PrivateRoute>
            } />
            <Route path="/expenses/settlement/:groupId" element={
              <PrivateRoute>
                <SettlementPlan />
              </PrivateRoute>
            } />
            <Route path="/expenses/analysis/:groupId" element={
              <PrivateRoute>
                <ExpenseAnalysis />
              </PrivateRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
