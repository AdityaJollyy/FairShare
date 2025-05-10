import { useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const Landing = () => {
    const { isAuthenticated } = useContext(AuthContext);

    if (isAuthenticated) {
        return <Navigate to="/dashboard" />;
    }

    return (
        <section className="landing">
            <div className="dark-overlay">
                <div className="landing-inner">
                    <h1>ExpenseShare</h1>
                    <p className="lead">
                        Split expenses with friends and track who owes what using advanced graph algorithms
                    </p>
                    <div className="buttons">
                        <Link to="/register" className="btn btn-primary">
                            Sign Up
                        </Link>
                        <Link to="/login" className="btn btn-light">
                            Login
                        </Link>
                    </div>
                    <div className="features">
                        <div className="feature">
                            <h3>Smart Expense Splitting</h3>
                            <p>
                                Our app uses graph algorithms to simplify debts and minimize the number of transactions needed to settle up.
                            </p>
                        </div>
                        <div className="feature">
                            <h3>Real-time Updates</h3>
                            <p>
                                Get instant notifications when expenses are added or settled using Socket.io.
                            </p>
                        </div>
                        <div className="feature">
                            <h3>Expense Analytics</h3>
                            <p>
                                Visualize spending patterns with interactive charts and graphs.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Landing; 