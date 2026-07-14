(function () {
    const STORAGE_KEY = 'nepixo-theme';

    function getPreferredTheme() {
        const savedTheme = localStorage.getItem(STORAGE_KEY);

        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }

        return window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';

        document.documentElement.dataset.theme = theme;

        const toggle = document.getElementById('themeToggle');
        const meta = document.getElementById('themeColorMeta');

        if (meta) {
            meta.setAttribute(
                'content',
                isDark ? '#111318' : '#ffffff'
            );
        }

        if (toggle) {
            toggle.setAttribute(
                'aria-label',
                isDark
                    ? 'Switch to light mode'
                    : 'Switch to dark mode'
            );

            toggle.setAttribute(
                'title',
                isDark
                    ? 'Switch to light mode'
                    : 'Switch to dark mode'
            );

            toggle.setAttribute(
                'aria-checked',
                String(isDark)
            );
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        applyTheme(getPreferredTheme());

        const toggle = document.getElementById('themeToggle');

        if (toggle) {
            toggle.addEventListener('click', function () {
                const currentTheme =
                    document.documentElement.dataset.theme === 'dark'
                        ? 'dark'
                        : 'light';

                const nextTheme =
                    currentTheme === 'dark'
                        ? 'light'
                        : 'dark';

                localStorage.setItem(
                    STORAGE_KEY,
                    nextTheme
                );

                applyTheme(nextTheme);
            });
        }
    });

    if (window.matchMedia) {
        const media = window.matchMedia(
            '(prefers-color-scheme: dark)'
        );

        const handleSystemTheme = function (event) {
            if (!localStorage.getItem(STORAGE_KEY)) {
                applyTheme(
                    event.matches
                        ? 'dark'
                        : 'light'
                );
            }
        };

        if (media.addEventListener) {
            media.addEventListener(
                'change',
                handleSystemTheme
            );
        } else if (media.addListener) {
            media.addListener(
                handleSystemTheme
            );
        }
    }
})();

function openMessagesPage(username) {
    sessionStorage.setItem('openChatWith', username);
    window.location.href = '/messages/';
}

function openMessageBox(username) {
    const box = document.getElementById('messageBox');

    if (box) {
        box.style.display = 'block';

        const receiverField =
            document.getElementById('messageReceiver');

        const messageHeader =
            document.getElementById('messageHeader');

        if (receiverField) {
            receiverField.value = username;
        }

        if (messageHeader) {
            messageHeader.textContent =
                'Message ' + username;
        }

        loadMessages(username);
    } else {
        openMessagesPage(username);
    }
}

function sendMessage() {
    const receiverField =
        document.getElementById('messageReceiver');

    const input =
        document.getElementById('messageInput');

    if (!receiverField || !input) {
        return;
    }

    const receiver =
        receiverField.value;

    const content =
        input.value.trim();

    if (!content) {
        return;
    }

    fetch('/send-message/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            receiver: receiver,
            content: content
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                input.value = '';
                loadMessages(receiver);
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
        });
}

function loadMessages(username) {
    fetch(
        '/get-messages/' +
        encodeURIComponent(username) +
        '/'
    )
        .then(response => response.json())
        .then(data => {
            const messageBody =
                document.getElementById('messageBody');

            if (!messageBody) {
                return;
            }

            messageBody.innerHTML = '';

            data.messages.forEach(msg => {
                const div =
                    document.createElement('div');

                div.className =
                    msg.is_me
                        ? 'message-right'
                        : 'message-left';

                const strong =
                    document.createElement('strong');

                strong.textContent =
                    msg.sender + ': ';

                const text =
                    document.createTextNode(
                        msg.content
                    );

                const time =
                    document.createElement('small');

                time.textContent =
                    msg.timestamp;

                div.append(
                    strong,
                    text,
                    time
                );

                messageBody.appendChild(div);
            });

            messageBody.scrollTop =
                messageBody.scrollHeight;
        })
        .catch(error => {
            console.error('Error loading messages:', error);
        });
}

function getCookie(name) {
    let cookieValue = null;

    if (document.cookie) {
        document.cookie
            .split(';')
            .some(rawCookie => {
                const cookie =
                    rawCookie.trim();

                if (
                    cookie.startsWith(
                        name + '='
                    )
                ) {
                    cookieValue =
                        decodeURIComponent(
                            cookie.substring(
                                name.length + 1
                            )
                        );

                    return true;
                }

                return false;
            });
    }

    return cookieValue;
}

document.addEventListener('DOMContentLoaded', function () {
    const messageInput =
        document.getElementById('messageInput');

    if (messageInput) {
        messageInput.addEventListener(
            'keydown',
            function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    sendMessage();
                }
            }
        );
    }
});

function getInitials(
    firstName,
    lastName,
    username
) {
    const source =
        firstName ||
        lastName ||
        username ||
        '?';

    return source
        .charAt(0)
        .toUpperCase();
}

function setupAvatar(
    imgElement,
    firstName,
    lastName,
    username,
    sizeClass = ''
) {
    if (!imgElement) {
        return;
    }

    const addFallback = function () {
        const container =
            imgElement.parentElement;

        if (
            !container ||
            container.querySelector(
                '.avatar-initials'
            )
        ) {
            return;
        }

        const fallback =
            document.createElement('div');

        fallback.className =
            (
                'avatar-initials ' +
                sizeClass
            ).trim();

        fallback.textContent =
            getInitials(
                firstName,
                lastName,
                username
            );

        imgElement.style.display =
            'none';

        container.appendChild(
            fallback
        );
    };

    if (
        !imgElement.getAttribute('src')
    ) {
        addFallback();
    }

    imgElement.addEventListener(
        'error',
        addFallback,
        { once: true }
    );
}

(function () {
    const COUNTS_URL = '/get-unread-counts/';
    const REFRESH_INTERVAL = 10000;

    function updateBadge(element, count) {
        if (!element) {
            return;
        }

        const numericCount = Number(count) || 0;

        if (numericCount > 0) {
            element.textContent =
                numericCount > 99
                    ? '99+'
                    : String(numericCount);

            element.style.display = 'block';
            element.setAttribute(
                'aria-label',
                numericCount + ' unread items'
            );
        } else {
            element.textContent = '';
            element.style.display = 'none';
        }
    }

    async function loadUnreadCounts() {
        const messageBadge =
            document.getElementById('unreadCount');

        const notificationBadge =
            document.getElementById('notificationCount');

        if (!messageBadge && !notificationBadge) {
            return;
        }

        try {
            const response = await fetch(COUNTS_URL, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(
                    'Unable to load unread counts'
                );
            }

            const data = await response.json();

            updateBadge(
                messageBadge,
                data.unread_messages
            );

            updateBadge(
                notificationBadge,
                data.unread_notifications
            );
        } catch (error) {
            console.error(
                'Unread count error:',
                error
            );
        }
    }

    document.addEventListener(
        'DOMContentLoaded',
        function () {
            loadUnreadCounts();

            window.setInterval(
                loadUnreadCounts,
                REFRESH_INTERVAL
            );
        }
    );

    window.refreshUnreadCounts =
        loadUnreadCounts;
})();

document.addEventListener('click', async function (event) {
    const button = event.target.closest('.js-follow-button');

    if (!button) {
        return;
    }

    const username = button.dataset.username;

    if (!username || button.disabled) {
        return;
    }

    const originalText = button.textContent.trim();

    button.disabled = true;
    button.textContent = 'Following...';

    try {
        const response = await fetch(
            '/follow/' + encodeURIComponent(username) + '/',
            {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Unable to follow user.');
        }

        if (data.followed) {
            button.textContent = 'Following';
            button.classList.add('following');
        } else {
            button.textContent = 'Follow';
            button.classList.remove('following');
        }
    } catch (error) {
        console.error('Follow error:', error);
        button.textContent = originalText;
        alert(error.message);
    } finally {
        button.disabled = false;
    }
});
