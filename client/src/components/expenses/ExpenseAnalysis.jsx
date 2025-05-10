import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#8DD1E1'];

const ExpenseAnalysis = () => {
    const { groupId } = useParams();
    const [group, setGroup] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch group and analysis data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get group details
                const groupRes = await axios.get(`/groups/${groupId}`);
                setGroup(groupRes.data);

                // Get expense analysis
                const analysisRes = await axios.get(`/expenses/analysis/${groupId}`);
                setAnalysis(analysisRes.data);

                setLoading(false);
            } catch (err) {
                setError('Error fetching analysis data');
                console.error('Error fetching analysis data:', err);
                setLoading(false);
            }
        };

        fetchData();
    }, [groupId]);

    if (loading) {
        return <div className="container">Loading...</div>;
    }

    if (!analysis) {
        return <div className="container">No analysis data available</div>;
    }

    return (
        <section className="container">
            <Link to={`/groups/${groupId}`} className="btn btn-light">
                Back to Group
            </Link>

            <h1>Expense Analysis</h1>
            <p>Group: {group && group.name}</p>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="analysis-content">
                <div className="analysis-summary">
                    <h3>Summary</h3>
                    <p>Total Expenses: Rs. {analysis.totalAmount.toFixed(2)}</p>
                </div>

                <div className="analysis-charts">
                    <div className="chart-container">
                        <h3>Expenses by Category</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={analysis.categoryExpenses}
                                    dataKey="amount"
                                    nameKey="category"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    fill="#8884d8"
                                    label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                                >
                                    {analysis.categoryExpenses.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `Rs. ${value.toFixed(2)}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-container">
                        <h3>Expenses by User</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={analysis.userExpenses}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value) => `Rs. ${value.toFixed(2)}`} />
                                <Legend />
                                <Bar dataKey="amount" fill="#8884d8">
                                    {analysis.userExpenses.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="analysis-details">
                    <h3>Expense Distribution</h3>
                    <div className="distribution-table">
                        <h4>By Category</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Amount</th>
                                    <th>Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.categoryExpenses.map((category, index) => (
                                    <tr key={index}>
                                        <td>{category.category}</td>
                                        <td>Rs. {category.amount.toFixed(2)}</td>
                                        <td>{category.percentage.toFixed(2)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="distribution-table">
                        <h4>By User</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Amount</th>
                                    <th>Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.userExpenses.map((user, index) => (
                                    <tr key={index}>
                                        <td>{user.name}</td>
                                        <td>Rs. {user.amount.toFixed(2)}</td>
                                        <td>{user.percentage.toFixed(2)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ExpenseAnalysis; 