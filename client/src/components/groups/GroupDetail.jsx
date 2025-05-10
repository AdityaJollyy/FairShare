import { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';

const GroupDetail = () => {
    const { id } = useParams();
    const { user, socket } = useContext(AuthContext);

    const [group, setGroup] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');

    // Fetch group details and expenses
    useEffect(() => {
        const fetchGroupData = async () => {
            try {
                // Get group details
                const groupRes = await axios.get(`/groups/${id}`);
                setGroup(groupRes.data);

                // Get group expenses
                const expensesRes = await axios.get(`/expenses/group/${id}`);
                setExpenses(expensesRes.data);

                setLoading(false);
            } catch (err) {
                setError('Error fetching group data');
                console.error('Error fetching group data:', err);
                setLoading(false);
            }
        };

        fetchGroupData();
    }, [id]);

    // Join socket room for this group
    useEffect(() => {
        if (socket && group) {
            socket.emit('join_group', id);

            // Listen for new expenses
            socket.on('expense_added', (data) => {
                setExpenses(prevExpenses => [...prevExpenses, data.expense]);
            });

            // Listen for settlement updates
            socket.on('settlement_update', (data) => {
                setExpenses(prevExpenses =>
                    prevExpenses.map(expense =>
                        expense._id === data.expenseId ? data.expense : expense
                    )
                );
            });

            // Listen for expense deletions
            socket.on('expense_deleted', (data) => {
                setExpenses(prevExpenses =>
                    prevExpenses.filter(expense => expense._id !== data.expenseId)
                );
            });

            // Listen for member removals
            socket.on('member_removed', (data) => {
                if (data.groupId === id) {
                    setGroup(prevGroup => ({
                        ...prevGroup,
                        members: prevGroup.members.filter(member => member.user !== data.userId)
                    }));
                }
            });
        }

        return () => {
            if (socket) {
                socket.emit('leave_group', id);
                socket.off('expense_added');
                socket.off('settlement_update');
                socket.off('expense_deleted');
                socket.off('member_removed');
            }
        };
    }, [socket, id, group]);

    const handleAddMember = async (e) => {
        e.preventDefault();

        try {
            const res = await axios.post(`/groups/${id}/members`, { email: newMemberEmail });
            setGroup(res.data);
            setNewMemberEmail('');
        } catch (err) {
            setError(err.response.data.message || 'Failed to add member');
            console.error('Error adding member:', err.response.data);
        }
    };

    const handleRemoveMember = async (userId) => {
        try {
            if (window.confirm('Are you sure you want to remove this member?')) {
                await axios.delete(`/groups/${id}/members/${userId}`);
                // Update the group state immediately
                setGroup(prevGroup => ({
                    ...prevGroup,
                    members: prevGroup.members.filter(member => member.user !== userId)
                }));
                // Emit socket event for real-time update
                if (socket) {
                    socket.emit('member_removed', {
                        groupId: id,
                        userId: userId
                    });
                }
            }
        } catch (err) {
            setError('Failed to remove member');
            console.error('Error removing member:', err);
        }
    };

    if (loading) {
        return <div className="container">Loading...</div>;
    }

    if (!group) {
        return <div className="container">Group not found</div>;
    }

    return (
        <section className="container">
            <Link to="/dashboard" className="btn btn-light">
                Back to Dashboard
            </Link>

            <div className="group-header">
                <h1>{group.name}</h1>
                <p>{group.description}</p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="group-actions">
                <Link to={`/expenses/add/${id}`} className="btn btn-primary">
                    Add Expense
                </Link>
                <Link to={`/expenses/settlement/${id}`} className="btn btn-success">
                    View Settlement Plan
                </Link>
                <Link to={`/expenses/analysis/${id}`} className="btn btn-info">
                    View Expense Analysis
                </Link>
            </div>

            <div className="group-content">
                <div className="members-section">
                    <h2>Members</h2>
                    <ul className="members-list">
                        {group.members.map(member => (
                            <li key={member.user} className="member-item">
                                <div className="member-info">
                                    <span className="member-name">{member.name}</span>
                                </div>
                                {group.createdBy === user._id && member.user !== user._id && (
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => handleRemoveMember(member.user)}
                                    >
                                        Remove
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>

                    {/* Add member form */}
                    <form onSubmit={handleAddMember} className="add-member-form">
                        <div className="form-group">
                            <input
                                type="email"
                                placeholder="Enter email to add member"
                                value={newMemberEmail}
                                onChange={(e) => setNewMemberEmail(e.target.value)}
                                required
                            />
                            <button type="submit" className="btn btn-primary">
                                Add Member
                            </button>
                        </div>
                    </form>
                </div>

                <div className="expenses-section">
                    <h2>Expenses</h2>
                    {expenses.length === 0 ? (
                        <p>No expenses yet. Add one to get started!</p>
                    ) : (
                        <div className="expenses-list">
                            {expenses.map(expense => (
                                <div key={expense._id} className="expense-item">
                                    <div className="expense-header">
                                        <h3>{expense.description}</h3>
                                        <span className="expense-amount">Rs. {expense.amount.toFixed(2)}</span>
                                        {expense.paidBy.user === user._id && (
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={async () => {
                                                    try {
                                                        if (window.confirm('Are you sure you want to delete this expense?')) {
                                                            await axios.delete(`/expenses/${expense._id}`);
                                                            // Update the expenses state immediately
                                                            setExpenses(prevExpenses =>
                                                                prevExpenses.filter(e => e._id !== expense._id)
                                                            );
                                                            // Emit socket event for real-time update
                                                            if (socket) {
                                                                socket.emit('expense_deleted', {
                                                                    groupId: id,
                                                                    expenseId: expense._id
                                                                });
                                                            }
                                                        }
                                                    } catch (err) {
                                                        setError('Failed to delete expense');
                                                        console.error('Error deleting expense:', err);
                                                    }
                                                }}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                    <div className="expense-details">
                                        <p>Paid by: {expense.paidBy.name}</p>
                                        <p>Date: {new Date(expense.date).toLocaleDateString()}</p>
                                        <p>Category: {expense.category}</p>
                                    </div>
                                    <div className="expense-splits">
                                        <h4>Split Among:</h4>
                                        <ul>
                                            {expense.splitAmong.map(split => (
                                                <li key={split.user} className={`split-item ${split.settled ? 'settled' : ''}`}>
                                                    <span>{split.name}: Rs. {split.amount.toFixed(2)}</span>
                                                    {split.user === user._id && !split.settled && expense.paidBy.user !== user._id && (
                                                        <button
                                                            className="btn btn-sm btn-success"
                                                            onClick={async () => {
                                                                try {
                                                                    const response = await axios.put(`/expenses/settle/${expense._id}`);
                                                                    // Update the expenses state immediately
                                                                    setExpenses(prevExpenses =>
                                                                        prevExpenses.map(exp =>
                                                                            exp._id === expense._id ? response.data : exp
                                                                        )
                                                                    );
                                                                    // Emit socket event for real-time update
                                                                    if (socket) {
                                                                        socket.emit('settlement_update', {
                                                                            groupId: id,
                                                                            expenseId: expense._id,
                                                                            expense: response.data
                                                                        });
                                                                    }
                                                                } catch (err) {
                                                                    setError('Failed to mark as settled');
                                                                    console.error('Error marking as settled:', err);
                                                                }
                                                            }}
                                                        >
                                                            Mark as Settled
                                                        </button>
                                                    )}
                                                    {split.settled && <span className="settled-badge">Settled</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default GroupDetail; 