const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const {
    buildDebtGraph,
    simplifyTransactions,
    findOptimalSettlementPlan,
    analyzeExpenseDistribution
} = require('../algorithms/graphAlgorithms');

// Add a new expense
exports.addExpense = async (req, res) => {
    try {
        const { description, amount, groupId, splitAmong, category } = req.body;

        // Find group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is a member of the group
        const isMember = group.members.some(member =>
            member.user.toString() === req.user.id
        );

        if (!isMember) {
            return res.status(403).json({ message: 'Not authorized to add expenses to this group' });
        }

        // Get user name
        const user = await User.findById(req.user.id);

        // Create new expense
        const newExpense = new Expense({
            description,
            amount,
            paidBy: {
                user: req.user.id,
                name: user.name
            },
            splitAmong: splitAmong.map(split => ({
                user: split.userId,
                name: split.name,
                amount: split.amount,
                settled: false
            })),
            group: groupId,
            category: category || 'Other'
        });

        // Save expense
        const expense = await newExpense.save();

        // Add expense to group
        group.expenses.push(expense._id);
        await group.save();

        res.json(expense);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get all expenses for a group
exports.getGroupExpenses = async (req, res) => {
    try {
        const { groupId } = req.params;

        // Find group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is a member of the group
        const isMember = group.members.some(member =>
            member.user.toString() === req.user.id
        );

        if (!isMember) {
            return res.status(403).json({ message: 'Not authorized to view expenses for this group' });
        }

        // Get expenses
        const expenses = await Expense.find({ group: groupId });

        res.json(expenses);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get settlement plan for a group
exports.getSettlementPlan = async (req, res) => {
    try {
        const { groupId } = req.params;

        // Find group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is a member of the group
        const isMember = group.members.some(member =>
            member.user.toString() === req.user.id
        );

        if (!isMember) {
            return res.status(403).json({ message: 'Not authorized to view settlement plan for this group' });
        }

        // Get expenses
        const expenses = await Expense.find({ group: groupId });

        // Build debt graph
        const debtGraph = buildDebtGraph(expenses);

        // Simplify transactions using graph algorithms
        const simplifiedGraph = simplifyTransactions(debtGraph);

        // Find optimal settlement plan
        const settlementPlan = findOptimalSettlementPlan(simplifiedGraph);

        // Add user names to settlement plan
        const userMap = {};
        group.members.forEach(member => {
            userMap[member.user] = member.name;
        });

        const formattedPlan = settlementPlan.map(settlement => ({
            from: {
                id: settlement.from,
                name: userMap[settlement.from]
            },
            to: {
                id: settlement.to,
                name: userMap[settlement.to]
            },
            amount: settlement.amount
        }));

        res.json(formattedPlan);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Mark an expense as settled for a user
exports.settleExpense = async (req, res) => {
    try {
        const { expenseId } = req.params;

        // Find expense
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        // Check if user is part of the expense and is the one who has to pay
        const userSplit = expense.splitAmong.find(split =>
            split.user.toString() === req.user.id
        );

        if (!userSplit) {
            return res.status(403).json({ message: 'Not authorized to settle this expense' });
        }

        // Check if the user is the one who paid (creator of the expense)
        if (expense.paidBy.user.toString() === req.user.id) {
            return res.status(403).json({ message: 'Only the person who has to pay can mark as settled' });
        }

        // Mark as settled
        userSplit.settled = true;
        await expense.save();

        res.json(expense);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get expense analysis for a group
exports.getExpenseAnalysis = async (req, res) => {
    try {
        const { groupId } = req.params;

        // Find group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is a member of the group
        const isMember = group.members.some(member =>
            member.user.toString() === req.user.id
        );

        if (!isMember) {
            return res.status(403).json({ message: 'Not authorized to view analysis for this group' });
        }

        // Get expenses
        const expenses = await Expense.find({ group: groupId });

        // Analyze expenses
        const analysis = analyzeExpenseDistribution(expenses);

        // Add user names to analysis
        const userMap = {};
        group.members.forEach(member => {
            userMap[member.user] = member.name;
        });

        const formattedAnalysis = {
            userExpenses: Object.entries(analysis.userExpenses).map(([userId, amount]) => ({
                userId,
                name: userMap[userId],
                amount,
                percentage: (amount / analysis.totalAmount) * 100
            })),
            categoryExpenses: Object.entries(analysis.categoryExpenses).map(([category, amount]) => ({
                category,
                amount,
                percentage: (amount / analysis.totalAmount) * 100
            })),
            totalAmount: analysis.totalAmount
        };

        res.json(formattedAnalysis);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Delete an expense
exports.deleteExpense = async (req, res) => {
    try {
        const { expenseId } = req.params;

        // Find expense
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        // Check if user is the one who created the expense
        if (expense.paidBy.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this expense' });
        }

        // Find the group to remove expense reference
        const group = await Group.findById(expense.group);
        if (group) {
            group.expenses = group.expenses.filter(id => id.toString() !== expenseId);
            await group.save();
        }

        // Delete the expense
        await Expense.findByIdAndDelete(expenseId);

        res.json({ message: 'Expense deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
}; 