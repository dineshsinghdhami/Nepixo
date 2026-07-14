document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.js-open-notification').forEach((button) => {
        button.addEventListener('click', () => openNotification(button.closest('.notification-item')));
    });

    document.querySelectorAll('.js-mark-read').forEach((button) => {
        button.addEventListener('click', () => markNotificationRead(button.closest('.notification-item')));
    });

    document.querySelectorAll('.js-follow-back').forEach((button) => {
        button.addEventListener('click', () => followBack(button));
    });

    document.getElementById('markAllBtn')?.addEventListener('click', markAllNotificationsRead);
    document.getElementById('clearAllBtn')?.addEventListener('click', clearAllNotifications);
});

async function openNotification(item) {
    if (!item) return;
    if (item.classList.contains('unread')) await markNotificationRead(item, false);
    const redirectUrl = item.dataset.redirectUrl;
    if (redirectUrl) window.location.href = redirectUrl;
}

async function markNotificationRead(item, updateButton = true) {
    if (!item) return false;
    const notificationId = item.dataset.notificationId;
    try {
        const response = await fetch(`/mark-notification-read/${notificationId}/`, {
            method: 'POST',
            headers: {'X-CSRFToken': getCsrfToken()}
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error('Unable to mark notification as read.');
        item.classList.remove('unread');
        if (updateButton) item.querySelector('.js-mark-read')?.remove();
        updateUnreadSummary(-1);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function markAllNotificationsRead() {
    const button = document.getElementById('markAllBtn');
    setButtonBusy(button, 'Marking...');
    try {
        const response = await fetch('/mark-all-notifications-read/', {
            method: 'POST',
            headers: {'X-CSRFToken': getCsrfToken()}
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error('Unable to mark notifications as read.');
        document.querySelectorAll('.notification-item.unread').forEach((item) => {
            item.classList.remove('unread');
            item.querySelector('.js-mark-read')?.remove();
        });
        document.querySelector('.unread-summary')?.remove();
        setButtonReady(button, 'All read');
    } catch (error) {
        window.alert(error.message);
        setButtonReady(button, 'Mark all read');
    }
}

async function clearAllNotifications() {
    const button = document.getElementById('clearAllBtn');
    if (!window.confirm('Clear all notifications?')) return;
    setButtonBusy(button, 'Clearing...');
    try {
        const response = await fetch('/clear-all-notifications/', {
            method: 'POST',
            headers: {'X-CSRFToken': getCsrfToken()}
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to clear notifications.');
        window.location.reload();
    } catch (error) {
        window.alert(error.message);
        setButtonReady(button, 'Clear all');
    }
}

async function followBack(button) {
    if (!button || button.disabled) return;
    const username = button.dataset.username;
    setButtonBusy(button, '...');
    try {
        const response = await fetch(`/follow/${encodeURIComponent(username)}/`);
        const data = await response.json();
        if (!response.ok || !data.followed) throw new Error(data.error || 'Unable to follow this user.');
        button.textContent = 'Following';
        button.classList.add('following');
        button.disabled = true;
        const item = button.closest('.notification-item');
        if (item?.classList.contains('unread')) await markNotificationRead(item);
    } catch (error) {
        window.alert(error.message);
        setButtonReady(button, 'Follow back');
    }
}

function updateUnreadSummary(change) {
    const summary = document.querySelector('.unread-summary');
    if (!summary) return;
    const current = Number.parseInt(summary.textContent, 10) || 0;
    const next = Math.max(0, current + change);
    if (!next) summary.remove();
    else summary.textContent = `${next} unread`;
}

function setButtonBusy(button, text) {
    if (!button) return;
    button.disabled = true;
    button.textContent = text;
}

function setButtonReady(button, text) {
    if (!button) return;
    button.disabled = false;
    button.textContent = text;
}

function getCsrfToken() {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}
