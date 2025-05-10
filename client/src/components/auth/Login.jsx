import { useState, useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';

const Login = () => {
    const { isAuthenticated, setUser, setIsAuthenticated } = useContext(AuthContext);

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const [error, setError] = useState('');

    const { email, password } = formData;

    const onChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const onSubmit = async e => {
        e.preventDefault();

        try {
            const res = await axios.post('/users/login', {
                email,
                password
            });

            // Save token to localStorage
            localStorage.setItem('token', res.data.token);

            // Set auth token header
            axios.defaults.headers.common['x-auth-token'] = res.data.token;

            // Get user data
            const userRes = await axios.get('/users/profile');

            // Set user and auth state
            setUser(userRes.data);
            setIsAuthenticated(true);

        } catch (err) {
            setError(err.response.data.message || 'Login failed');
            console.error('Login error:', err.response.data);
        }
    };

    // Redirect if authenticated
    if (isAuthenticated) {
        return <Navigate to="/dashboard" />;
    }

    return (
        <section className="container">
            <h1>Sign In</h1>
            <p>Sign Into Your Account</p>

            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={onSubmit}>
                <div className="form-group">
                    <input
                        type="email"
                        placeholder="Email Address"
                        name="email"
                        value={email}
                        onChange={onChange}
                        required
                    />
                </div>
                <div className="form-group">
                    <input
                        type="password"
                        placeholder="Password"
                        name="password"
                        value={password}
                        onChange={onChange}
                        minLength="6"
                        required
                    />
                </div>
                <input type="submit" className="btn btn-primary" value="Login" />
            </form>
            <p className="my-1">
                Don't have an account? <Link to="/register">Sign Up</Link>
            </p>
        </section>
    );
};

export default Login; 