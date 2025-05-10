import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';

const Dashboard = () => {
    const { user, socket } = useContext(AuthContext);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch user's groups
    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const res = await axios.get('/groups');
                setGroups(res.data);
                setLoading(false);
            } catch (err) {
                setError('Error fetching groups');
                console.error('Error fetching groups:', err);
                setLoading(false);
            }
        };

        fetchGroups();
    }, []);

    // Listen for real-time updates
    useEffect(() => {
        if (socket) {
            // Listen for new expense notifications
            socket.on('expense_added', (data) => {
                console.log('New expense added:', data);
                // You could update the UI or show a notification here
            });

            // Listen for settlement updates
            socket.on('settlement_update', (data) => {
                console.log('Settlement update:', data);
                // You could update the UI or show a notification here
            });

            // Listen for group deletions
            socket.on('group_deleted', (data) => {
                setGroups(prevGroups => prevGroups.filter(group => group._id !== data.groupId));
            });
        }

        return () => {
            if (socket) {
                socket.off('expense_added');
                socket.off('settlement_update');
                socket.off('group_deleted');
            }
        };
    }, [socket]);

    const handleDeleteGroup = async (groupId) => {
        try {
            if (window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
                await axios.delete(`/groups/${groupId}`);
                // Update groups state immediately
                setGroups(prevGroups => prevGroups.filter(group => group._id !== groupId));
                // Emit socket event for real-time update
                if (socket) {
                    socket.emit('group_deleted', { groupId });
                }
            }
        } catch (err) {
            setError('Failed to delete group');
            console.error('Error deleting group:', err);
        }
    };

    if (loading) {
        return <div className="container">Loading...</div>;
    }

    return (
        <section className="container">
            <h1 className="large">Dashboard</h1>
            <p className="lead">
                <i className="fas fa-user"></i> Welcome {user && user.name}
            </p>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="dashboard-actions">
                <Link to="/groups/create" className="btn btn-primary">
                    Create New Group
                </Link>
            </div>

            <h2 className="my-2">Your Groups</h2>

            {groups.length === 0 ? (
                <p>You haven't joined any groups yet. Create one to get started!</p>
            ) : (
                <div className="groups">
                    {groups.map(group => (
                        <div key={group._id} className="group bg-light">
                            <div>
                                <h2>{group.name}</h2>
                                <p>{group.description}</p>
                                <p>Members: {group.members.length}</p>
                                <p>Expenses: {group.expenses.length}</p>
                            </div>
                            <div className="group-actions">
                                <Link to={`/groups/${group._id}`} className="btn btn-primary">
                                    View Group
                                </Link>
                                {group.createdBy === user._id && (
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => handleDeleteGroup(group._id)}
                                    >
                                        Delete Group
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default Dashboard; 
