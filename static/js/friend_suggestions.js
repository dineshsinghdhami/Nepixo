document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.js-follow-button').forEach((button) => {
        button.addEventListener('click', () => followSuggestedUser(button));
    });
});

async function followSuggestedUser(button) {
    const userId = button.dataset.userId;
    if (!userId || button.disabled) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '...';
    try {
        const response = await fetch('/follow/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken()},
            body: JSON.stringify({user_id: userId})
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to follow this user.');
        button.textContent = 'Following';
        button.classList.add('following');
    } catch (error) {
        button.textContent = originalText;
        window.alert(error.message);
    } finally {
        button.disabled = false;
    }
}

function getCsrfToken() {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}
