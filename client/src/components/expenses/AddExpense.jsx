import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import './AddExpense.css';

const AddExpense = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { socket } = useContext(AuthContext);
    // Reference to the top of the form section
    const formRef = useRef(null);

    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        category: 'Other',
        splitType: 'equal' // equal, percentage, custom
    });

    // Add a calculation amount state to preserve the original amount input
    const [calculationAmount, setCalculationAmount] = useState(0);
    // Store the original amount as entered by the user
    const [originalAmount, setOriginalAmount] = useState('');

    const [splits, setSplits] = useState([]);
    // Track which members have been manually modified
    const [modifiedMembers, setModifiedMembers] = useState(new Set());

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

    // Update calculation amount whenever amount changes
    useEffect(() => {
        if (amount) {
            // Keep the original string value in originalAmount
            setOriginalAmount(amount);
            // Parse for calculations
            setCalculationAmount(parseFloat(amount));
        }
    }, [amount]);

    const onChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });

        // Update calculation amount when amount changes
        if (e.target.name === 'amount') {
            // Store the exact value entered by the user
            setOriginalAmount(e.target.value);
            // Parse for calculations
            const numAmount = parseFloat(e.target.value) || 0;
            setCalculationAmount(numAmount);
        }

        // Recalculate splits when amount or split type changes
        if (e.target.name === 'amount' || e.target.name === 'splitType') {
            updateSplits(
                e.target.name === 'amount' ? e.target.value : amount,
                e.target.name === 'splitType' ? e.target.value : splitType
            );
        }

        // Reset modified members when switching to equal or percentage split
        if (e.target.name === 'splitType' && (e.target.value === 'equal' || e.target.value === 'percentage')) {
            setModifiedMembers(new Set());
        }
    };

    const updateSplits = (newAmount, newSplitType) => {
        // Use the new calculation amount
        const numAmount = parseFloat(newAmount) || 0;
        setCalculationAmount(numAmount);

        if (newSplitType === 'equal') {
            // Equal split
            const memberCount = splits.length;
            const equalAmount = memberCount > 0 ? numAmount / memberCount : 0;

            setSplits(splits.map(split => ({
                ...split,
                amount: parseFloat(equalAmount.toFixed(2)),
                percentage: parseFloat((100 / memberCount).toFixed(2))
            })));

            // Reset modified members when switching to equal split
            setModifiedMembers(new Set());
        }
        else if (newSplitType === 'percentage') {
            // Set equal percentages initially for percentage split
            const memberCount = splits.length;
            const equalPercentage = memberCount > 0 ? 100 / memberCount : 0;

            setSplits(splits.map(split => {
                const percentage = parseFloat(equalPercentage.toFixed(2));
                return {
                    ...split,
                    percentage: percentage,
                    amount: parseFloat(((numAmount * percentage) / 100).toFixed(2))
                };
            }));            // Reset modified members when switching to percentage split
            setModifiedMembers(new Set());
        }
        // For custom, we don't auto-update
    };

    const handleSplitChange = (index, field, value) => {
        const newSplits = [...splits];

        // Store the raw input value first
        newSplits[index][field] = value;

        // Use calculationAmount instead of amount
        const totalAmount = calculationAmount;

        // Only convert to number for calculations, keeping the empty string if empty
        const numValue = value === '' ? 0 : parseFloat(value) || 0;

        // Update based on field changed
        if (field === 'amount') {
            // When amount is changed, update percentage
            if (totalAmount > 0) {
                newSplits[index].percentage = parseFloat(((numValue / totalAmount) * 100).toFixed(2));
            }
        } else if (field === 'percentage') {
            // When percentage is changed, update amount
            newSplits[index].amount = parseFloat(((totalAmount * numValue) / 100).toFixed(2));
        }

        // Mark this member as manually modified - create a new Set to ensure state update
        const newModifiedMembers = new Set([...modifiedMembers]);
        newModifiedMembers.add(newSplits[index].userId);
        setModifiedMembers(newModifiedMembers);

        setSplits(newSplits);
    };

    // Function to distribute remaining amount equally among unmodified members
    const distributeRemaining = () => {
        // Use calculationAmount instead of parsing amount
        const totalAmount = calculationAmount;
        if (totalAmount <= 0) {
            setError('Please enter a valid expense amount first');
            // Scroll to top when error is shown
            window.scrollTo(0, 0);
            return;
        }

        if (splitType === 'custom') {            // Calculate currently allocated amount
            const allocatedAmount = splits.reduce((sum, split) => {
                if (modifiedMembers.has(split.userId)) {
                    return sum + (parseFloat(split.amount) || 0);
                }
                return sum;
            }, 0);            // Calculate remaining amount
            const remainingAmount = totalAmount - allocatedAmount;

            // Count unmodified members
            const unmodifiedCount = splits.length - modifiedMembers.size;
            if (unmodifiedCount <= 0) {
                setError('All members have been manually assigned amounts. Please reset one member to auto-distribute.');
                window.scrollTo(0, 0);
                return;
            }

            // Calculate amount per unmodified member
            const amountPerMember = remainingAmount / unmodifiedCount;

            if (amountPerMember < 0) {
                setError('The total of manually assigned amounts exceeds the expense total. Please adjust the values.');
                window.scrollTo(0, 0);
                return;
            }

            // Update splits
            const newSplits = splits.map(split => {
                if (!modifiedMembers.has(split.userId)) {
                    const newAmount = parseFloat(amountPerMember.toFixed(2));
                    return {
                        ...split,
                        amount: newAmount,
                        percentage: parseFloat(((newAmount / totalAmount) * 100).toFixed(2))
                    };
                }
                return split;
            });

            setSplits(newSplits);
            setError(''); // Clear any previous errors
        } else if (splitType === 'percentage') {
            // Calculate currently allocated percentage
            const allocatedPercentage = splits.reduce((sum, split) => {
                if (modifiedMembers.has(split.userId)) {
                    return sum + (parseFloat(split.percentage) || 0);
                }
                return sum;
            }, 0);            // Calculate remaining percentage
            const remainingPercentage = 100 - allocatedPercentage;

            // Count unmodified members
            const unmodifiedCount = splits.length - modifiedMembers.size;
            if (unmodifiedCount <= 0) {
                setError('All members have been manually assigned percentages. Please reset one member to auto-distribute.');
                window.scrollTo(0, 0);
                return;
            }

            // Calculate percentage per unmodified member
            const percentagePerMember = remainingPercentage / unmodifiedCount;

            if (percentagePerMember < 0) {
                setError('The total of manually assigned percentages exceeds 100%. Please adjust the values.');
                window.scrollTo(0, 0);
                return;
            }

            // Update splits
            const newSplits = splits.map(split => {
                if (!modifiedMembers.has(split.userId)) {
                    const newPercentage = parseFloat(percentagePerMember.toFixed(2));
                    return {
                        ...split,
                        percentage: newPercentage,
                        amount: parseFloat(((totalAmount * newPercentage) / 100).toFixed(2))
                    };
                }
                return split;
            });

            setSplits(newSplits);
            setError(''); // Clear any previous errors
        }
    };

    const resetCustomSplits = () => {
        // Reset all splits to equal
        // Use calculationAmount instead of parsing amount
        const numAmount = calculationAmount;
        const memberCount = splits.length;
        const equalAmount = memberCount > 0 ? numAmount / memberCount : 0;
        const equalPercentage = memberCount > 0 ? 100 / memberCount : 0;

        if (splitType === 'custom') {
            setSplits(splits.map(split => ({
                ...split,
                amount: parseFloat(equalAmount.toFixed(2)),
                percentage: parseFloat(equalPercentage.toFixed(2))
            })));
        } else if (splitType === 'percentage') {
            setSplits(splits.map(split => {
                const percentage = parseFloat(equalPercentage.toFixed(2));
                return {
                    ...split,
                    percentage: percentage,
                    amount: parseFloat(((numAmount * percentage) / 100).toFixed(2))
                };
            }));
        }        // Clear all modified members
        setModifiedMembers(new Set());
        setError(''); // Clear any previous errors    
    }; const onSubmit = async e => {
        e.preventDefault();

        // Validate amount field manually before browser validation
        if (!originalAmount || originalAmount.trim() === '' || parseFloat(originalAmount) <= 0) {
            setError('Please enter a valid expense amount');
            window.scrollTo(0, 0);
            return;
        }

        // Only validate percentage equals 100% (validation of amount will be done on the backend)
        const totalPercentage = splits.reduce((sum, split) => sum + (parseFloat(split.percentage) || 0), 0);

        // Use the original amount for submission
        const expenseAmount = parseFloat(originalAmount);

        if (Math.abs(totalPercentage - 100) > 1) {
            setError(`Total percentage must equal 100%. Current: ${totalPercentage.toFixed(2)}%`);
            window.scrollTo(0, 0);
            return;
        }

        try {
            const res = await axios.post('/expenses', {
                description,
                amount: expenseAmount, // Send original amount to server
                groupId,
                splitAmong: splits.map(split => ({
                    userId: split.userId,
                    name: split.name,
                    amount: split.amount,
                    pendingSettlement: false,
                    settled: false
                })),
                category
            });            // Emit socket event for real-time update
            if (socket) {
                console.log('Emitting expense_added event');
                socket.emit('expense_added', {
                    groupId,
                    expense: res.data
                });
            }

            // Scroll to top before navigating
            window.scrollTo(0, 0);

            // Redirect back to group page
            navigate(`/groups/${groupId}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add expense');
            console.error('Error adding expense:', err.response?.data || err);
            window.scrollTo(0, 0);
        }
    };

    if (loading) {
        return (
            <div className="container loading-container">
                <div className="loading-spinner">
                    <i className="fas fa-circle-notch fa-spin"></i>
                </div>
                <p>Loading group data...</p>
            </div>
        );
    }

    if (!group) {
        return (
            <div className="container error-container">
                <div className="error-icon">
                    <i className="fas fa-exclamation-triangle"></i>
                </div>
                <h2>Group Not Found</h2>
                <p>The group you're looking for doesn't exist or you don't have access to it.</p>
                <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
                    Return to Dashboard
                </button>
            </div>
        );
    } return (
        <section className="container" ref={formRef}>
            <button onClick={() => navigate(`/groups/${groupId}`)} className="btn btn-light">
                <i className="fas fa-arrow-left"></i> Back to Group
            </button>

            <div className="group-header">
                <h1>Add New Expense</h1>
                <p>Group: {group.name}</p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <form className="expense-form" onSubmit={onSubmit}>
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
                </div>                <div className="form-group">
                    <label htmlFor="amount">Amount (Rs.)</label>
                    <input
                        type="number"
                        id="amount"
                        name="amount"
                        value={originalAmount}
                        onChange={onChange}
                        step="0.01"
                        min="0.01"
                        required
                        onInvalid={(e) => {
                            e.preventDefault();
                            setError('Please enter a valid expense amount');
                            window.scrollTo(0, 0);
                        }}
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
                </div>                <div className="form-group">
                    <label>Split Type</label>
                    <div className="split-type-options">
                        <div className="split-type-option">
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
                        <div className="split-type-option">
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
                        <div className="split-type-option">
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
                    </div>
                </div>

                <div className="splits-section">
                    <h3>Split Among</h3>
                    {(splitType === 'custom' || splitType === 'percentage') && (
                        <div className="custom-split-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={distributeRemaining}
                            >
                                Auto-Distribute Remaining
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={resetCustomSplits}
                            >
                                Reset to Equal
                            </button>
                        </div>
                    )}                    <div className="splits-list">
                        {splits.map((split, index) => (
                            <div key={split.userId} className="split-item">
                                <span className="split-name">{split.name}</span>
                                <div className="split-inputs">
                                    <div className="split-input">
                                        <label>Amount (Rs.)</label>
                                        <input type="number"
                                            value={split.amount}
                                            onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                                            onBlur={(e) => {
                                                if (e.target.value === '') {
                                                    const newSplits = [...splits];
                                                    newSplits[index].amount = 0;
                                                    setSplits(newSplits);
                                                }
                                            }}
                                            step="0.01"
                                            min="0"
                                            disabled={splitType !== 'custom'}
                                        />
                                    </div>                                    <div className="split-input">
                                        <label>Percentage (%)</label>                                        <input
                                            type="number"
                                            value={split.percentage === 0 && splitType === 'percentage' ? '' : split.percentage}
                                            onChange={(e) => handleSplitChange(index, 'percentage', e.target.value)}
                                            onBlur={(e) => {
                                                if (e.target.value === '') {
                                                    const newSplits = [...splits];
                                                    newSplits[index].percentage = 0;
                                                    setSplits(newSplits);
                                                }
                                            }} step="0.01"
                                            min="0"
                                            max="100"
                                            disabled={splitType !== 'percentage'}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}</div>                    <div className="splits-summary">                        <p>
                            Total Split Amount: Rs. {splits.reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0).toFixed(2)}
                        </p>                        <p>
                            Total Percentage: {splits.reduce((sum, split) => sum + (parseFloat(split.percentage) || 0), 0).toFixed(2)}%
                        </p>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn btn-primary">
                        Add Expense
                    </button>
                </div>
            </form>
        </section>
    );
};

export default AddExpense;