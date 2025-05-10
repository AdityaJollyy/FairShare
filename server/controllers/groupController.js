const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');

// Create a new group
exports.createGroup = async (req, res) => {
    try {
        const { name, description } = req.body;

        // Get current user
        const user = await User.findById(req.user.id);

        // Create new group
        const newGroup = new Group({
            name,
            description,
            members: [{
                user: req.user.id,
                name: user.name,
                email: user.email
            }],
            createdBy: req.user.id
        });

        // Save group
        const group = await newGroup.save();

        // Add group to user's groups
        user.groups.push(group._id);
        await user.save();

        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get all groups for a user
exports.getUserGroups = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const groups = await Group.find({ _id: { $in: user.groups } });

        res.json(groups);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get a single group by ID
exports.getGroupById = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('expenses');

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is a member of the group
        const isMember = group.members.some(member =>
            member.user.toString() === req.user.id
        );

        if (!isMember) {
            return res.status(403).json({ message: 'Not authorized to access this group' });
        }

        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Add a member to a group
exports.addMember = async (req, res) => {
    try {
        const { email } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Find group
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is already a member
        const isMember = group.members.some(member =>
            member.user.toString() === user._id.toString()
        );

        if (isMember) {
            return res.status(400).json({ message: 'User is already a member of this group' });
        }

        // Add user to group
        group.members.push({
            user: user._id,
            name: user.name,
            email: user.email
        });

        await group.save();

        // Add group to user's groups
        user.groups.push(group._id);
        await user.save();

        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Remove a member from a group
exports.removeMember = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find group
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is the group creator
        if (group.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to remove members' });
        }

        // Remove user from group
        group.members = group.members.filter(member =>
            member.user.toString() !== userId
        );

        await group.save();

        // Remove group from user's groups
        const user = await User.findById(userId);
        if (user) {
            user.groups = user.groups.filter(groupId =>
                groupId.toString() !== group._id.toString()
            );
            await user.save();
        }

        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Delete a group
exports.deleteGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is the creator of the group
        if (group.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this group' });
        }

        // Remove group reference from all members
        for (const member of group.members) {
            const user = await User.findById(member.user);
            if (user) {
                user.groups = user.groups.filter(groupId => groupId.toString() !== req.params.id);
                await user.save();
            }
        }

        // Delete all expenses associated with the group
        await Expense.deleteMany({ group: req.params.id });

        // Delete the group
        await Group.findByIdAndDelete(req.params.id);

        res.json({ message: 'Group deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
}; 