import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const Navbar = () => {
    const { isAuthenticated, setUser, setIsAuthenticated } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        // Clear user data and token
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);

        // Redirect to login
        navigate('/login');
    };

    const authLinks = (
        <ul>
            <li>
                <Link to="/dashboard">Dashboard</Link>
            </li>
            <li>
                <a href="#!" onClick={handleLogout}>
                    Logout
                </a>
            </li>
        </ul>
    );

    const guestLinks = (
        <ul>
            <li>
                <Link to="/register">Register</Link>
            </li>
            <li>
                <Link to="/login">Login</Link>
            </li>
        </ul>
    );

    return (
        <nav className="navbar">
            <h1>
                <Link to="/">
                    <i className="fas fa-money-bill-wave"></i> ExpenseShare
                </Link>
            </h1>
            <div className="navbar-links">
                {isAuthenticated ? authLinks : guestLinks}
            </div>
        </nav>
    );
};

export default Navbar; 