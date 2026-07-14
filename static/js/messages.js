(() => {
    const page = document.getElementById('messagesPage');
    if (!page) return;

    const rows = [...document.querySelectorAll('.conversation-row')];
    const activeChat = document.getElementById('activeChat');
    const placeholder = document.getElementById('chatPlaceholder');
    const list = document.getElementById('chatMessageList');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const search = document.getElementById('conversationSearch');
    const backButton = document.getElementById('chatBack');
    const profileLink = document.getElementById('chatProfileLink');
    const viewProfileLink = document.getElementById('chatViewProfile');

    let currentUser = '';
    let pollTimer = null;
    let lastMessageId = 0;

    rows.forEach(row => {
        row.addEventListener('click', () => {
            openConversation(row.dataset.username, row);
        });
    });

    if (backButton) {
        backButton.addEventListener('click', closeConversation);
    }

    if (form) {
        form.addEventListener('submit', sendMessage);
    }

    if (search) {
        search.addEventListener('input', filterConversations);
    }

    const requestedUser =
        page.dataset.openUser ||
        sessionStorage.getItem('openChatWith');

    if (requestedUser) {
        sessionStorage.removeItem('openChatWith');

        const row = rows.find(
            item => item.dataset.username === requestedUser
        );

        openConversation(requestedUser, row || null);
    }

    async function openConversation(username, row) {
        if (!username) return;

        currentUser = username;

        rows.forEach(item => {
            item.classList.toggle('active', item === row);
        });

        if (row) {
            const badge = row.querySelector('.conversation-preview-row b');
            if (badge) badge.remove();
        }

        const displayName =
            row?.querySelector('.conversation-name-row strong')
                ?.textContent
                .trim() || username;

        document.getElementById('chatName').textContent = displayName;
        document.getElementById('chatUsername').textContent = '@' + username;

        const profileUrl =
            '/profile/' + encodeURIComponent(username) + '/';

        profileLink.href = profileUrl;
        viewProfileLink.href = profileUrl;

        const sourceAvatar = row?.querySelector('.conversation-avatar');
        const targetAvatar = document.getElementById('chatAvatar');

        targetAvatar.innerHTML = sourceAvatar
            ? sourceAvatar.innerHTML
            : '<span>' + escapeHtml(username.charAt(0).toUpperCase()) + '</span>';

        placeholder.hidden = true;
        activeChat.hidden = false;
        page.classList.add('chat-open');

        await loadMessages();

        input.focus();

        clearInterval(pollTimer);
        pollTimer = setInterval(checkForNewMessages, 3000);
    }

    async function loadMessages() {
        showChatStatus('Loading messages…');

        try {
            const response = await fetch(
                '/get-messages/' +
                encodeURIComponent(currentUser) +
                '/'
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Unable to load messages.'
                );
            }

            list.innerHTML = '';

            data.messages.forEach(addBubble);

            lastMessageId =
                data.messages.length
                    ? data.messages[data.messages.length - 1].id
                    : 0;

            if (!data.messages.length) {
                showChatStatus('No messages yet. Start the conversation.');
            }

            scrollToBottom();
        } catch (error) {
            showChatStatus(error.message);
        }
    }

    async function sendMessage(event) {
        event.preventDefault();

        const content = input.value.trim();

        if (!content || !currentUser) return;

        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;

        try {
            const response = await fetch('/send-message/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken()
                },
                body: JSON.stringify({
                    receiver: currentUser,
                    content: content
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || 'Unable to send message.'
                );
            }

            input.value = '';

            if (list.querySelector('.chat-status')) {
                list.innerHTML = '';
            }

            addBubble({
                id: data.message.id,
                content: data.message.content,
                timestamp: data.message.timestamp,
                is_me: true
            });

            lastMessageId = data.message.id;
            scrollToBottom();
        } catch (error) {
            window.alert(error.message);
        } finally {
            button.disabled = false;
            input.focus();
        }
    }

    async function checkForNewMessages() {
        if (!currentUser) return;

        try {
            const response = await fetch(
                '/check-new-messages/' +
                encodeURIComponent(currentUser) +
                '/?last_id=' +
                lastMessageId
            );

            const data = await response.json();

            if (!response.ok || !Array.isArray(data.new_messages)) {
                return;
            }

            if (data.new_messages.length && list.querySelector('.chat-status')) {
                list.innerHTML = '';
            }

            data.new_messages.forEach(message => {
                addBubble(message);
                lastMessageId = Math.max(
                    lastMessageId,
                    Number(message.id) || 0
                );
            });

            if (data.new_messages.length) {
                scrollToBottom();
            }
        } catch (_) {
            // Keep polling silently.
        }
    }

    function addBubble(message) {
        const bubble = document.createElement('div');
        bubble.className =
            'chat-bubble' +
            (message.is_me ? ' mine' : '');

        const content = document.createElement('span');
        content.textContent = message.content || '';

        const time = document.createElement('time');
        time.textContent = message.timestamp || '';

        bubble.append(content, time);
        list.appendChild(bubble);
    }

    function filterConversations() {
        const query = search.value.trim().toLowerCase();

        rows.forEach(row => {
            const haystack =
                (row.dataset.searchText || '').toLowerCase();

            row.hidden =
                query.length > 0 &&
                !haystack.includes(query);
        });
    }

    function showChatStatus(message) {
        list.innerHTML = '';

        const status = document.createElement('div');
        status.className = 'chat-status';
        status.textContent = message;

        list.appendChild(status);
    }

    function closeConversation() {
        page.classList.remove('chat-open');
        clearInterval(pollTimer);
    }

    function scrollToBottom() {
        list.scrollTop = list.scrollHeight;
    }

    function csrfToken() {
        const match = document.cookie.match(
            /(?:^|; )csrftoken=([^;]*)/
        );

        return match
            ? decodeURIComponent(match[1])
            : '';
    }

    function escapeHtml(value) {
        const node = document.createElement('div');
        node.textContent = value || '';
        return node.innerHTML;
    }

    window.addEventListener('beforeunload', () => {
        clearInterval(pollTimer);
    });
})();