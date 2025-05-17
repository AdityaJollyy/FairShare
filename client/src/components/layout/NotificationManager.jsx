import React, { useState, useEffect, useContext } from 'react';
import AuthContext from '../../context/AuthContext';
import Notification from './Notification';
import axios from 'axios';

const NotificationManager = () => {
    const [notifications, setNotifications] = useState([]);
    const { socket, user } = useContext(AuthContext);

    useEffect(() => {
        if (socket && user) {
            // Listen for new invitation notifications
            socket.on('invitation_received', (data) => {
                if (data.invitedEmail === user.email) {
                    const notification = {
                        id: new Date().getTime(),
                        message: `You've been invited to join group "${data.groupName}" by ${data.inviterName}. Check your dashboard for details.`,
                        type: 'info'
                    };
                    setNotifications(prevNotifications => [...prevNotifications, notification]);

                    // Force refresh pending invitations in the background
                    axios.get('/groups/invitations/pending')
                        .catch(err => console.error('Error fetching invitations:', err));
                }
            });

            // Listen for invitation responses
            socket.on('invitation_response', (data) => {
                const notification = {
                    id: new Date().getTime(),
                    message: `${data.userName} has ${data.status === 'accept' ? 'accepted' : 'declined'} your invitation to join the group.`,
                    type: data.status === 'accept' ? 'success' : 'error'
                };
                setNotifications(prevNotifications => [...prevNotifications, notification]);
            });

            // Listen for member added event
            socket.on('member_added', (data) => {
                const notification = {
                    id: new Date().getTime(),
                    message: `${data.userName} has joined one of your groups.`,
                    type: 'success'
                };
                setNotifications(prevNotifications => [...prevNotifications, notification]);
            });

            // Listen for expense notifications
            socket.on('expense_added', (data) => {
                const notification = {
                    id: new Date().getTime(),
                    message: `New expense added in a group you belong to.`,
                    type: 'info'
                };
                setNotifications(prevNotifications => [...prevNotifications, notification]);
            });

            // Listen for expense settlement notifications
            socket.on('settlement_update', (data) => {
                // Only show notification if the expense was paid by the current user
                if (data.expense && data.expense.paidBy && data.expense.paidBy.user === user._id) {
                    // Find the settled user
                    const settledSplit = data.expense.splitAmong.find(split => split.settled && split.user !== user._id);
                    if (settledSplit) {
                        const notification = {
                            id: new Date().getTime(),
                            message: `${settledSplit.name} has marked their share of "${data.expense.description}" as settled.`,
                            type: 'success'
                        };
                        setNotifications(prevNotifications => [...prevNotifications, notification]);
                    }
                }
            });

            // Listen for expense deleted notifications
            socket.on('expense_deleted', (data) => {
                const notification = {
                    id: new Date().getTime(),
                    message: `An expense has been deleted in one of your groups.`,
                    type: 'info'
                };
                setNotifications(prevNotifications => [...prevNotifications, notification]);
            });
        }

        return () => {
            if (socket) {
                socket.off('invitation_received');
                socket.off('invitation_response');
                socket.off('member_added');
                socket.off('expense_added');
                socket.off('settlement_update');
                socket.off('expense_deleted');
            }
        };
    }, [socket, user]);

    const removeNotification = (id) => {
        setNotifications(notifications.filter(notification => notification.id !== id));
    };

    return (
        <div className="notification-container">
            {notifications.map(notification => (
                <Notification
                    key={notification.id}
                    message={notification.message}
                    type={notification.type}
                    onClose={() => removeNotification(notification.id)}
                />
            ))}
        </div>
    );
};

export default NotificationManager;
