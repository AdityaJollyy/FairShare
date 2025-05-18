import { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import './Profile.css';

const Profile = () => {
    const { user, setUser } = useContext(AuthContext);
    const passwordSectionRef = useRef(null);
    const profileTopRef = useRef(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(true); const [message, setMessage] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Auto-clear message after 3 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                setMessage(null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [message]);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            setLoading(false);
        }
    }, [user]);

    const onChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }; const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setMessage(null);

        try {
            // Only name can be updated
            const updateData = {
                name: formData.name
            };

            const res = await axios.put('/users/profile', updateData);

            // Update global user state
            setUser(res.data); setMessage({
                type: 'success',
                text: 'Profile updated successfully'
            });

            setIsEditing(false);
        } catch (err) {
            console.error('Error updating profile:', err);
            setMessage({
                type: 'error',
                text: err.response?.data?.message || 'Error updating profile'
            });
        }
    }; const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage(null);

        // Validate passwords
        if (formData.newPassword !== formData.confirmPassword) {
            setMessage({
                type: 'error',
                text: 'New passwords do not match'
            });
            return;
        }

        if (formData.newPassword.length < 6) {
            setMessage({
                type: 'error',
                text: 'Password must be at least 6 characters'
            });
            return;
        }

        try {
            await axios.put('/users/password', {
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword
            });

            setMessage({
                type: 'success',
                text: 'Password changed successfully'
            });

            // Reset password fields
            setFormData({
                ...formData,
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });

            setIsChangingPassword(false);

            // Scroll back to top
            profileTopRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            console.error('Error changing password:', err);
            setMessage({
                type: 'error',
                text: err.response?.data?.message || 'Error changing password'
            });
        }
    };

    // Scroll to password section when changing password
    useEffect(() => {
        if (isChangingPassword && passwordSectionRef.current) {
            passwordSectionRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isChangingPassword]);

    if (loading) {
        return <div className="container">Loading...</div>;
    } return (
        <section className="container" ref={profileTopRef}>
            <h1>Your Profile</h1>

            {message && !isChangingPassword && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                    {message.text}
                </div>
            )}

            <div className="profile-card">
                <div className="profile-header">
                    <div className="profile-avatar">
                        <i className="fas fa-user-circle"></i>
                    </div>
                    <h2>{user.name}</h2>
                </div>

                {!isEditing ? (
                    <div className="profile-info">
                        <div className="info-item">
                            <i className="fas fa-envelope"></i>
                            <span>{user.email}</span>
                        </div>
                        <div className="info-item">
                            <i className="fas fa-phone"></i>
                            <span>{user.phone}</span>
                        </div>
                        <div className="info-item">
                            <i className="fas fa-calendar-alt"></i>
                            <span>Member since: {new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setIsEditing(true);
                                setMessage(null);
                            }}
                        >
                            <i className="fas fa-edit"></i> Edit Profile
                        </button>                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setIsChangingPassword(true);
                                setMessage(null);
                                // Use setTimeout to ensure the password section is rendered before scrolling
                                setTimeout(() => {
                                    passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                            }}
                        >
                            <i className="fas fa-key"></i> Change Password
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleProfileUpdate} className="profile-form">
                        <div className="form-group">
                            <label htmlFor="name">Name</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={onChange}
                                required
                            />
                        </div>                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                disabled
                                className="disabled-input"
                            />
                            <small className="form-text">Email cannot be changed</small>
                        </div>
                        <div className="form-group">
                            <label htmlFor="phone">Phone Number</label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                disabled
                                className="disabled-input"
                            />
                            <small className="form-text">Phone number cannot be changed</small>
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn btn-success">
                                <i className="fas fa-save"></i> Save Changes
                            </button>                            <button
                                type="button"
                                className="btn btn-light"
                                onClick={() => {
                                    setIsEditing(false);
                                    setMessage(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>)}                {isChangingPassword && (
                        <div className="password-change-card" ref={passwordSectionRef}>
                            <h3>Change Password</h3>
                            {message && isChangingPassword && (
                                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                                    {message.text}
                                </div>
                            )}
                            <form onSubmit={handlePasswordChange}>
                                <div className="form-group">
                                    <label htmlFor="currentPassword">Current Password</label>
                                    <input
                                        type="password"
                                        id="currentPassword"
                                        name="currentPassword"
                                        value={formData.currentPassword}
                                        onChange={onChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="newPassword">New Password</label>
                                    <input
                                        type="password"
                                        id="newPassword"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={onChange}
                                        minLength="6"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="confirmPassword">Confirm New Password</label>
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={onChange}
                                        minLength="6"
                                        required
                                    />
                                </div>

                                <div className="form-actions">
                                    <button type="submit" className="btn btn-success">
                                        <i className="fas fa-key"></i> Update Password
                                    </button>                                <button
                                        type="button"
                                        className="btn btn-light"
                                        onClick={() => {
                                            setIsChangingPassword(false);
                                            setMessage(null);
                                            // Reset password fields
                                            setFormData({
                                                ...formData,
                                                currentPassword: '',
                                                newPassword: '',
                                                confirmPassword: ''
                                            });
                                            // Scroll back to top
                                            profileTopRef.current?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
            </div>
        </section>
    );
};

export default Profile;
