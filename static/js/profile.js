let currentPostIdToDelete = null;

function getProfilePage() {
    return document.getElementById('profilePage');
}

function openProfileMessages(username) {
    const page = getProfilePage();
    sessionStorage.setItem('openChatWith', username);
    window.location.href = page ? page.dataset.messagesUrl : '/messages/';
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function renderUserList(container, users, emptyMessage) {
    container.innerHTML = '';

    if (!users || users.length === 0) {
        container.innerHTML = `
            <div class="profile-modal-status">
                ${escapeHtml(emptyMessage)}
            </div>
        `;
        return;
    }

    users.forEach(user => {
        const row = document.createElement('a');

        row.className = 'profile-user-row';
        row.href =
            '/profile/' +
            encodeURIComponent(user.username) +
            '/';

        const avatar = document.createElement('span');
        avatar.className = 'profile-user-avatar';

        const initial = document.createElement('span');
        initial.className = 'profile-user-avatar-fallback';

        const initialSource =
            user.first_name ||
            user.full_name ||
            user.username ||
            '?';

        initial.textContent =
            initialSource.charAt(0).toUpperCase();

        avatar.appendChild(initial);

        if (user.profile_pic) {
            const image = document.createElement('img');

            image.src = user.profile_pic;
            image.alt = user.username || 'Profile picture';

            image.onerror = function () {
    this.style.display = "none";
};

            avatar.appendChild(image);
        }

        const copy = document.createElement('span');
        copy.className = 'profile-user-copy';

        const name = document.createElement('strong');

        name.textContent =
            user.full_name ||
            user.username ||
            'User';

        const username = document.createElement('span');

        username.textContent =
            '@' + (user.username || '');

        copy.append(name, username);
        row.append(avatar, copy);
        container.appendChild(row);
    });
}

function loadConnectionList(username, type) {
    const modalId = type === 'followers' ? 'followersModal' : 'followingModal';
    const listId = type === 'followers' ? 'followersList' : 'followingList';
    const container = document.getElementById(listId);

    container.innerHTML = '<div class="profile-modal-status">Loading…</div>';
    openModal(modalId);

    fetch(`/api/${type}/${encodeURIComponent(username)}/`)
        .then(response => {
            if (!response.ok) throw new Error('Unable to load people');
            return response.json();
        })
        .then(data => {
            const users = data[type] || [];
            renderUserList(
                container,
                users,
                type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'
            );
        })
        .catch(error => {
            console.error(error);
            container.innerHTML = '<div class="profile-modal-status">Unable to load this list.</div>';
        });
}

function showFollowers(username) {
    loadConnectionList(username, 'followers');
}

function showFollowing(username) {
    loadConnectionList(username, 'following');
}

function followUser(username) {
    const button = document.getElementById('followBtn');
    if (button) button.disabled = true;

    fetch('/follow/' + encodeURIComponent(username) + '/')
        .then(response => response.json())
        .then(data => {
            if (button) {
                button.textContent = data.followed ? 'Unfollow' : 'Follow';
                button.disabled = false;
            }
            window.location.reload();
        })
        .catch(error => {
            console.error(error);
            if (button) button.disabled = false;
        });
}

function togglePostMenu(postId) {
    const menu = document.getElementById('postMenu-' + postId);
    if (!menu) return;

    document.querySelectorAll('.post-menu.open').forEach(openMenu => {
        if (openMenu !== menu) openMenu.classList.remove('open');
    });

    menu.classList.toggle('open');
}

function editPost(postId) {
    const content = document.getElementById('postContent-' + postId);
    const form = document.getElementById('editForm-' + postId);
    const textarea = document.getElementById('editTextarea-' + postId);
    const menu = document.getElementById('postMenu-' + postId);

    if (!content || !form || !textarea) return;

    content.style.display = 'none';
    form.style.display = 'block';
    if (menu) menu.classList.remove('open');
    textarea.focus();
    textarea.selectionStart = textarea.value.length;
}

function cancelEdit(postId) {
    const content = document.getElementById('postContent-' + postId);
    const form = document.getElementById('editForm-' + postId);

    if (content) content.style.display = '';
    if (form) form.style.display = 'none';
}

function saveEdit(postId) {
    const textarea = document.getElementById('editTextarea-' + postId);
    const content = document.getElementById('postContent-' + postId);
    const form = document.getElementById('editForm-' + postId);

    if (!textarea || !content || !form) return;

    const newContent = textarea.value.trim();
    if (!newContent) {
        textarea.focus();
        return;
    }

    const button = form.querySelector('.save-edit-btn');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Saving…';

    fetch('/edit-post/' + postId + '/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: 'content=' + encodeURIComponent(newContent)
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) throw new Error(data.error || 'Unable to update post');

            content.innerHTML = String(data.content || newContent)
                .split('\n')
                .map(line => escapeHtml(line))
                .join('<br>');

            content.style.display = '';
            form.style.display = 'none';
        })
        .catch(error => {
            console.error(error);
            alert('Unable to update this post.');
        })
        .finally(() => {
            button.disabled = false;
            button.textContent = originalText;
        });
}

function deletePost(postId) {
    currentPostIdToDelete = postId;
    const menu = document.getElementById('postMenu-' + postId);
    if (menu) menu.classList.remove('open');
    openModal('confirmationModal');
}

function cancelDelete() {
    currentPostIdToDelete = null;
    closeModal('confirmationModal');
}

function confirmDelete() {
    if (!currentPostIdToDelete) return;
    const postId = currentPostIdToDelete;

    fetch('/delete-post/' + postId + '/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) throw new Error('Unable to delete post');

            const post = document.getElementById('post-' + postId);
            if (post) {
                post.style.opacity = '0';
                post.style.transform = 'translateY(-8px)';
                post.style.transition = 'opacity .2s ease, transform .2s ease';
                setTimeout(() => post.remove(), 200);
            }

            cancelDelete();
        })
        .catch(error => {
            console.error(error);
            alert('Unable to delete this post.');
        });
}

function likePost(postId) {
    fetch('/like/' + postId + '/')
        .then(response => response.json())
        .then(data => {
            const label = document.getElementById('likeText-' + postId);
            const count = document.getElementById('likeCount-' + postId);

            if (label) label.textContent = data.liked ? 'Liked' : 'Like';
            if (count) count.textContent = data.count || 0;
        });
}

function toggleComment(postId) {
    const section = document.getElementById('comments-' + postId);
    if (!section) return;

    const opening = section.hidden;
    section.hidden = !opening;

    if (opening) {
        loadComments(postId);
        const input = document.getElementById('commentInput-' + postId);
        if (input) input.focus();
    }
}

function addComment(postId) {
    const input = document.getElementById('commentInput-' + postId);
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    fetch('/comment/' + postId + '/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: 'content=' + encodeURIComponent(content)
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) throw new Error('Unable to add comment');
            input.value = '';
            addCommentToUI(postId, data.comment);
            updateCommentCount(postId);
        })
        .catch(error => {
            console.error(error);
        });
}

function loadComments(postId) {
    const list = document.getElementById('commentList-' + postId);
    if (!list) return;

    list.innerHTML = '<div class="profile-modal-status">Loading comments…</div>';

    fetch('/get-comments/' + postId + '/')
        .then(response => response.json())
        .then(data => {
            list.innerHTML = '';

            if (!data.comments.length) {
                list.innerHTML = '<div class="profile-modal-status">No comments yet.</div>';
                return;
            }

            data.comments.forEach(comment => addCommentToUI(postId, comment, false));
        })
        .catch(error => {
            console.error(error);
            list.innerHTML = '<div class="profile-modal-status">Unable to load comments.</div>';
        });
}

function addCommentToUI(postId, comment, scrollToBottom = true) {
    const list = document.getElementById('commentList-' + postId);
    if (!list) return;

    if (list.querySelector('.profile-modal-status')) list.innerHTML = '';

    const item = document.createElement('div');
    item.className = 'profile-comment-item';

    const avatar = document.createElement('div');
    avatar.className = 'profile-comment-avatar';

    const image = document.createElement('img');
    image.src = comment.profile_pic || 'https://via.placeholder.com/32';
    image.alt = comment.user || 'User';
    avatar.appendChild(image);

    const body = document.createElement('div');
    body.className = 'profile-comment-body';

    const head = document.createElement('div');
    head.className = 'profile-comment-head';

    const name = document.createElement('strong');
    name.textContent = comment.user || 'User';

    const time = document.createElement('time');
    time.textContent = comment.created_at || '';

    const text = document.createElement('p');
    text.textContent = comment.content || '';

    head.append(name, time);
    body.append(head, text);
    item.append(avatar, body);
    list.appendChild(item);

    if (scrollToBottom) list.scrollTop = list.scrollHeight;
}

function updateCommentCount(postId) {
    fetch('/get-comments/' + postId + '/')
        .then(response => response.json())
        .then(data => {
            const count = document.getElementById('commentCount-' + postId);
            if (count) count.textContent = data.comments.length;
        });
}

function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value || '';
    return element.innerHTML;
}

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[id^="commentInput-"]').forEach(input => {
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                const postId = input.id.replace('commentInput-', '');
                addComment(postId);
            }
        });
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.post-menu') && !event.target.closest('.post-menu-button')) {
            document.querySelectorAll('.post-menu.open').forEach(menu => menu.classList.remove('open'));
        }

        if (event.target.classList.contains('profile-modal')) {
            closeModal(event.target.id);
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.profile-modal.open').forEach(modal => closeModal(modal.id));
            document.querySelectorAll('.post-menu.open').forEach(menu => menu.classList.remove('open'));
        }
    });
});
