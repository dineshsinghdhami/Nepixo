
    let cropper;
    let currentImageUrl;
    document.getElementById('imageUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                showMessage('error', 'File is too large! Maximum size is 2MB.');
                return;
            }
            
            if (!file.type.match('image.*')) {
                showMessage('error', 'Please select an image file!');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                currentImageUrl = e.target.result;
                const image = document.getElementById('imageToCrop');
                image.src = currentImageUrl;
                document.getElementById('cropModal').style.display = 'flex';
                image.onload = function() {
                    if (cropper) {
                        cropper.destroy();
                    }
                    
                    cropper = new Cropper(image, {
                        aspectRatio: 1,
                        viewMode: 1,
                        autoCropArea: 0.8,
                        responsive: true,
                        restore: false,
                        guides: true,
                        center: true,
                        highlight: false,
                        cropBoxMovable: true,
                        cropBoxResizable: true,
                        toggleDragModeOnDblclick: false,
                        minContainerWidth: 300,
                        minContainerHeight: 300,
                        ready: function() {
                            this.cropper.setDragMode('crop');
                        }
                    });
                };
            };
            
            reader.readAsDataURL(file);
        }
    });
    function rotateImage(degrees) {
        if (cropper) {
            cropper.rotate(degrees);
        }
    }
    function resetCrop() {
        if (cropper) {
            cropper.reset();
        }
    }

    function cancelCrop() {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        
        document.getElementById('cropModal').style.display = 'none';
        document.getElementById('imageUpload').value = '';
    }
    
    function applyCrop() {
        if (cropper) {
            const canvas = cropper.getCroppedCanvas({
                width: 400,
                height: 400,
                fillColor: '#fff',
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });
            const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.9);
            document.getElementById('currentProfilePic').src = croppedImageUrl;
            document.getElementById('croppedImage').value = croppedImageUrl;
            document.getElementById('cropModal').style.display = 'none';
            cropper.destroy();
            cropper = null;
            document.getElementById('imageUpload').value = '';
            saveProfilePicture(croppedImageUrl);
        }
    }

    async function saveProfilePicture(croppedImageUrl) {
        try {
            showMessage('loading', 'Updating profile picture...');
            const response = await fetch(croppedImageUrl);
            const blob = await response.blob();
            const file = new File([blob], 'profile_pic.jpg', { type: 'image/jpeg' });
            
            const formData = new FormData();
            formData.append('csrfmiddlewaretoken', csrftoken);
            formData.append('first_name', document.querySelector('input[name="first_name"]').value);
            formData.append('last_name', document.querySelector('input[name="last_name"]').value);
            formData.append('username', document.querySelector('input[name="username"]').value);
            formData.append('bio', document.querySelector('textarea[name="bio"]').value);
            formData.append('profile_pic', file);
            formData.append('save_profile_pic_only', 'true');
            
            const submitResponse = await fetch('', {
                method: 'POST',
                body: formData
            });
            
            if (submitResponse.ok) {
                showMessage('success', 'Profile picture updated successfully!');
                setTimeout(() => {
                    const messageDiv = document.getElementById('profilePicMessage');
                    messageDiv.innerHTML = '';
                }, 2000);
                
            } else {
                showMessage('error', 'Error saving profile picture. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage('error', 'Error saving profile picture. Please try again.');
        }
    }

    function showMessage(type, text) {
        const messageDiv = document.getElementById('profilePicMessage');
        messageDiv.innerHTML = '';
        let icon, className;
        switch(type) {
            case 'success':
                icon = '<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/></svg>';
                className = 'success-message';
                break;
            case 'error':
                icon = '<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>';
                className = 'error-message';
                break;
            case 'loading':
                icon = '<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16" style="animation: spin 1s linear infinite;"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/></svg>';
                className = 'loading-message';
                break;
        }
        messageDiv.innerHTML = `
            <div class="${className}">
                ${icon}
                <span>${text}</span>
            </div>
        `;
        
        if (type === 'error') {
            setTimeout(() => {
                const messageDiv = document.getElementById('profilePicMessage');
                messageDiv.innerHTML = '';
            }, 3000);
        }
        
        if (type === 'loading') {
            setTimeout(() => {
                const messageDiv = document.getElementById('profilePicMessage');
                if (messageDiv.innerHTML.includes('loading')) {
                    messageDiv.innerHTML = '';
                    showMessage('error', 'Request timed out. Please try again.');
                }
            }, 5000);
        }
    }
    document.getElementById('profileForm').addEventListener('submit', async function(e) {
        const croppedImage = document.getElementById('croppedImage').value;
        
        if (croppedImage) {
            e.preventDefault();
            
            try {
                const response = await fetch(croppedImage);
                const blob = await response.blob();
                const file = new File([blob], 'profile_pic.jpg', { type: 'image/jpeg' });
                const formData = new FormData();
                formData.append('csrfmiddlewaretoken', csrftoken);
                formData.append('first_name', this.first_name.value);
                formData.append('last_name', this.last_name.value);
                formData.append('username', this.username.value);
                formData.append('bio', this.bio.value);
                formData.append('profile_pic', file);
                
                showMessage('loading', 'Saving profile changes...');
                const submitResponse = await fetch('', {
                    method: 'POST',
                    body: formData
                });
                
                if (submitResponse.ok) {
                    
                    showMessage('success', 'Profile updated successfully!');
                
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    showMessage('error', 'Error saving profile. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('error', 'Error saving profile. Please try again.');
            }
        }
        
        if (document.getElementById('imageUpload').files.length > 0 && !croppedImage) {
            e.preventDefault();
            showMessage('error', 'Please finish cropping your image before saving.');
        }
    });
    
    function deleteAccount() {
        if (confirm('Are you absolutely sure you want to delete your account?\n\nThis will permanently delete:\n• All your posts\n• All your comments\n• Your profile information\n• Your connections\n\nThis action cannot be undone!')) {
            alert('Account deletion feature is not yet available.');
        }
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('cropModal').style.display === 'flex') {
            cancelCrop();
        }
    });
    
    document.getElementById('cropModal').addEventListener('click', function(e) {
        if (e.target === this) {
            cancelCrop();
        }
    });


    // Remove Profile Picture Functions
function confirmRemoveProfilePic() {
    const confirmModal = document.getElementById('removePicConfirmModal');
    if (confirmModal) {
        confirmModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeRemoveConfirm() {
    const confirmModal = document.getElementById('removePicConfirmModal');
    if (confirmModal) {
        confirmModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

async function removeProfilePicture() {
    closeRemoveConfirm();
    
    try {
        showMessage('loading', 'Removing profile picture...');
        
        const formData = new FormData();
       formData.append('csrfmiddlewaretoken', csrftoken);
        formData.append('first_name', document.querySelector('input[name="first_name"]').value);
        formData.append('last_name', document.querySelector('input[name="last_name"]').value);
        formData.append('username', document.querySelector('input[name="username"]').value);
        formData.append('bio', document.querySelector('textarea[name="bio"]').value);
        formData.append('remove_profile_pic', 'true');
        
        const response = await fetch('', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            showMessage('success', 'Profile picture removed successfully!');
            
            // Update the UI to show initials
            const currentPic = document.getElementById('currentProfilePic');
          const initials = document.getElementById('profileData').dataset.initials;
            
            // Replace image with initials div
            const newDiv = document.createElement('div');
            newDiv.id = 'currentProfilePic';
            newDiv.className = 'profile-image';
            newDiv.style.cssText = 'background:linear-gradient(135deg,#1877f2,#42b72a);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:72px;color:white;text-transform:uppercase;width:180px;height:180px;border-radius:50%;object-fit:cover;border:4px solid #1877f2;cursor:pointer;';
            newDiv.textContent = initials;
            newDiv.onclick = function() { document.getElementById('imageUpload').click(); };
            
            currentPic.parentElement.replaceChild(newDiv, currentPic);
            
            // Remove the remove button since there's no picture
            const removeBtn = document.getElementById('removeProfilePicBtn');
            if (removeBtn) {
                removeBtn.remove();
            }
            
            // Clear cropped image value
            document.getElementById('croppedImage').value = '';
            
            setTimeout(() => {
                const messageDiv = document.getElementById('profilePicMessage');
                messageDiv.innerHTML = '';
            }, 2000);
        } else {
            showMessage('error', 'Error removing profile picture. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('error', 'Error removing profile picture. Please try again.');
    }
}

// Update the applyCrop function to show remove button after cropping
function applyCrop() {
    if (cropper) {
        const canvas = cropper.getCroppedCanvas({
            width: 400,
            height: 400,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.9);
        const currentProfilePic = document.getElementById('currentProfilePic');
        
        // Check if remove button exists, if not add it
        if (!document.getElementById('removeProfilePicBtn')) {
            const removeBtnHtml = `
                <div style="text-align: center; margin-top: 10px;">
                    <button type="button" id="removeProfilePicBtn" class="btn-remove-pic" onclick="confirmRemoveProfilePic()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                        Remove Profile Picture
                    </button>
                </div>
            `;
            const imageSection = document.querySelector('.profile-image-section');
            imageSection.insertAdjacentHTML('beforeend', removeBtnHtml);
        }
        
        // If it's an img element, update src
        if (currentProfilePic.tagName === 'IMG') {
            currentProfilePic.src = croppedImageUrl;
        } else {
            // If it's a div with initials, replace it with img
            const newImg = document.createElement('img');
            newImg.id = 'currentProfilePic';
            newImg.className = 'profile-image';
            newImg.src = croppedImageUrl;
            newImg.alt = 'Profile Picture';
            newImg.onclick = function() { document.getElementById('imageUpload').click(); };
            newImg.onerror = function() { 
                this.style.display = 'none'; 
                this.parentElement.innerHTML = '<div id="currentProfilePic" class="profile-image" style="background:linear-gradient(135deg,#1877f2,#42b72a);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:72px;color:white;text-transform:uppercase;width:180px;height:180px;border-radius:50%;object-fit:cover;border:4px solid #1877f2;cursor:pointer;" onclick="document.getElementById(\'imageUpload\').click()">{{ user.first_name|first|default:user.username|first|upper }}</div>';
            };
            currentProfilePic.parentElement.replaceChild(newImg, currentProfilePic);
        }
        
        document.getElementById('croppedImage').value = croppedImageUrl;
        document.getElementById('cropModal').style.display = 'none';
        cropper.destroy();
        cropper = null;
        document.getElementById('imageUpload').value = '';
        saveProfilePicture(croppedImageUrl);
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const confirmModal = document.getElementById('removePicConfirmModal');
    if (confirmModal && e.target === confirmModal) {
        closeRemoveConfirm();
    }
});

// Close modal on ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const confirmModal = document.getElementById('removePicConfirmModal');
        if (confirmModal && confirmModal.style.display === 'flex') {
            closeRemoveConfirm();
        }
    }
});

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const csrftoken = getCookie('csrftoken');