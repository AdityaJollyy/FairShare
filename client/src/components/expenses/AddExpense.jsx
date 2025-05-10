import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';

const AddExpense = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { socket } = useContext(AuthContext);

    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        category: 'Other',
        splitType: 'equal' // equal, percentage, custom
    });

    const [splits, setSplits] = useState([]);

    const { description, amount, category, splitType } = formData;

    // Fetch group details
    useEffect(() => {
        const fetchGroup = async () => {
            try {
                const res = await axios.get(`/groups/${groupId}`);
                setGroup(res.data);

                // Initialize splits with group members
                const initialSplits = res.data.members.map(member => ({
                    userId: member.user,
                    name: member.name,
                    amount: 0,
                    percentage: 0
                }));

                setSplits(initialSplits);
                setLoading(false);
            } catch (err) {
                setError('Error fetching group data');
                console.error('Error fetching group data:', err);
                setLoading(false);
            }
        };

        fetchGroup();
    }, [groupId]);

    const onChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });

        // Recalculate splits when amount or split type changes
        if (e.target.name === 'amount' || e.target.name === 'splitType') {
            updateSplits(e.target.name === 'amount' ? e.target.value : amount, e.target.name === 'splitType' ? e.target.value : splitType);
        }
    };

    const updateSplits = (newAmount, newSplitType) => {
        const numAmount = parseFloat(newAmount) || 0;

        if (newSplitType === 'equal') {
            // Equal split
            const memberCount = splits.length;
            const equalAmount = memberCount > 0 ? numAmount / memberCount : 0;

            setSplits(splits.map(split => ({
                ...split,
                amount: parseFloat(equalAmount.toFixed(2)),
                percentage: parseFloat((100 / memberCount).toFixed(2))
            })));
        } else if (newSplitType === 'percentage') {
            // Keep percentages, update amounts
            setSplits(splits.map(split => ({
                ...split,
                amount: parseFloat((numAmount * (split.percentage / 100)).toFixed(2))
            })));
        }
        // For custom, we don't auto-update
    };

    const handleSplitChange = (index, field, value) => {
        const newSplits = [...splits];
        const numValue = parseFloat(value) || 0;

        newSplits[index][field] = numValue;

        // Update the other field based on the changed field
        if (field === 'amount') {
            const totalAmount = parseFloat(amount) || 0;
            if (totalAmount > 0) {
                newSplits[index].percentage = parseFloat(((numValue / totalAmount) * 100).toFixed(2));
            }
        } else if (field === 'percentage') {
            const totalAmount = parseFloat(amount) || 0;
            newSplits[index].amount = parseFloat(((numValue / 100) * totalAmount).toFixed(2));
        }

        setSplits(newSplits);
    };

    const onSubmit = async e => {
        e.preventDefault();

        // Validate total split amount equals expense amount
        const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0);
        const expenseAmount = parseFloat(amount);

        if (Math.abs(totalSplitAmount - expenseAmount) > 0.01) {
            setError(`Split amounts must equal the total expense amount (${expenseAmount})`);
            return;
        }

        try {
            const res = await axios.post('/expenses', {
                description,
                amount: expenseAmount,
                groupId,
                splitAmong: splits,
                category
            });

            // Emit socket event for real-time update
            if (socket) {
                socket.emit('new_expense', {
                    groupId,
                    expense: res.data
                });
            }

            // Redirect back to group page
            navigate(`/groups/${groupId}`);

        } catch (err) {
            setError(err.response.data.message || 'Failed to add expense');
            console.error('Error adding expense:', err.response.data);
        }
    };

    if (loading) {
        return <div className="container">Loading...</div>;
    }

    return (
        <section className="container">
            <h1>Add New Expense</h1>
            <p>Group: {group && group.name}</p>

            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={onSubmit}>
                <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <input
                        type="text"
                        id="description"
                        name="description"
                        value={description}
                        onChange={onChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="amount">Amount (Rs.)</label>
                    <input
                        type="number"
                        id="amount"
                        name="amount"
                        value={amount}
                        onChange={onChange}
                        step="0.01"
                        min="0.01"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="category">Category</label>
                    <select
                        id="category"
                        name="category"
                        value={category}
                        onChange={onChange}
                    >
                        <option value="Food">Food</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Housing">Housing</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Travel">Travel</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Split Type</label>
                    <div className="split-type-options">
                        <div>
                            <input
                                type="radio"
                                id="equal"
                                name="splitType"
                                value="equal"
                                checked={splitType === 'equal'}
                                onChange={onChange}
                            />
                            <label htmlFor="equal">Equal</label>
                        </div>
                        <div>
                            <input
                                type="radio"
                                id="percentage"
                                name="splitType"
                                value="percentage"
                                checked={splitType === 'percentage'}
                                onChange={onChange}
                            />
                            <label htmlFor="percentage">Percentage</label>
                        </div>
                        <div>
                            <input
                                type="radio"
                                id="custom"
                                name="splitType"
                                value="custom"
                                checked={splitType === 'custom'}
                                onChange={onChange}
                            />
                            <label htmlFor="custom">Custom</label>
                        </div>
                    </div>
                </div>

                <div className="splits-section">
                    <h3>Split Among</h3>
                    <div className="splits-list">
                        {splits.map((split, index) => (
                            <div key={split.userId} className="split-item">
                                <span className="split-name">{split.name}</span>
                                <div className="split-inputs">
                                    <div className="split-input">
                                        <label>Amount (Rs.)</label>
                                        <input
                                            type="number"
                                            value={split.amount}
                                            onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                                            step="0.01"
                                            min="0"
                                            disabled={splitType !== 'custom'}
                                        />
                                    </div>
                                    <div className="split-input">
                                        <label>Percentage (%)</label>
                                        <input
                                            type="number"
                                            value={split.percentage}
                                            onChange={(e) => handleSplitChange(index, 'percentage', e.target.value)}
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            disabled={splitType !== 'percentage'}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="splits-summary">
                        <p>
                            Total Split Amount: Rs. {splits.reduce((sum, split) => sum + split.amount, 0).toFixed(2)}
                        </p>
                        <p>
                            Total Percentage: {splits.reduce((sum, split) => sum + split.percentage, 0).toFixed(2)}%
                        </p>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn btn-primary">
                        Add Expense
                    </button>
                    <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => navigate(`/groups/${groupId}`)}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </section>
    );
};

export default AddExpense; 