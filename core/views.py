from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from .models import *
from django.db.models import Q
import json
from django.db.models import Q, Count
import os
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.shortcuts import render
from django.db.models import Q, Count
from .models import User, Follow
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import json
# views.py
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.models import User
from .utils import generate_temp_password, send_temp_password_email

def forget_password_view(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        
        try:
            # Check if user exists
            user = User.objects.get(email=email)
            
            # Generate temporary password
            temp_password = generate_temp_password()
            
            # Set the temporary password
            user.set_password(temp_password)
            user.save()
            
            # Send email with temporary password
            email_sent = send_temp_password_email(email, temp_password)
            
            if email_sent:
                messages.success(request, 'A temporary password has been sent to your email. Please check your inbox.')
                # Redirect to login page
                return redirect('login')
            else:
                messages.error(request, 'Failed to send email. Please try again later.')
                
        except User.DoesNotExist:
            # Don't reveal that user doesn't exist (security best practice)
            messages.success(request, 'If an account exists with this email, a temporary password has been sent.')
            return redirect('login')
            
        except Exception as e:
            messages.error(request, f'An error occurred: {str(e)}')
    
    return render(request, 'forgetpassword.html')

def compress_image(image):
    """Compress image to reduce file size"""
    try:
        # Open image
        img = Image.open(image)
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # Save as JPEG with quality 85%
        output = BytesIO()
        img.save(output, format='JPEG', quality=85, optimize=True)
        output.seek(0)
        
        return ContentFile(output.read(), name=image.name)
    except Exception as e:
        print(f"Error compressing image: {e}")
        return image
    
def visitor_home(request):
    """Show visitor homepage for non-logged in users"""
    # Show recent public posts
    public_posts = Post.objects.all().order_by('-created_at')[:10]
    
    # Get total user count for stats
    total_users = User.objects.count()
    total_posts = Post.objects.count()
    
    # Get some sample users for display
    sample_users = User.objects.order_by('-date_joined')[:6]
    
    return render(request, 'visitor_home.html', {
        'public_posts': public_posts,
        'total_users': total_users,
        'total_posts': total_posts,
        'sample_users': sample_users
    })

@csrf_exempt
@require_POST
@login_required
def follow_user(request):
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        
        if not user_id:
            return JsonResponse({'success': False, 'error': 'User ID is required'})
        
        user_to_follow = User.objects.get(id=user_id)
        
        # Check if already following
        if Follow.objects.filter(follower=request.user, following=user_to_follow).exists():
            return JsonResponse({'success': False, 'error': 'Already following this user'})
        
        # Create follow relationship
        Follow.objects.create(follower=request.user, following=user_to_follow)
        
        return JsonResponse({'success': True})
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
    
    
# Add this function to your views.py (after mark_all_notifications_read)

@csrf_exempt
@login_required
def clear_all_notifications(request):
    """
    Clear all notifications for the current user
    """
    if request.method == 'POST':
        try:
            # Delete all notifications for the user
            deleted_count, _ = Notification.objects.filter(
                recipient=request.user
            ).delete()
            
            return JsonResponse({
                'success': True,
                'message': f'Cleared {deleted_count} notifications',
                'deleted_count': deleted_count
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': str(e)
            })
    
    return JsonResponse({'success': False, 'message': 'Invalid request method'})

@csrf_exempt
@login_required
def unfollow_user(request, username=None):
    """
    Combined function that handles both:
    1. AJAX unfollow requests (POST with user_id in JSON body)
    2. Regular unfollow requests (with username in URL)
    """
    
    # Determine which type of request this is
    if request.method == 'POST' and request.content_type == 'application/json':
        # Handle AJAX request from friend suggestions
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            
            if not user_id:
                return JsonResponse({'success': False, 'error': 'User ID is required'})
            
            user_to_unfollow = User.objects.get(id=user_id)
            
            # Delete follow relationship
            deleted_count, _ = Follow.objects.filter(
                follower=request.user, 
                following=user_to_unfollow
            ).delete()
            
            if deleted_count > 0:
                return JsonResponse({'success': True})
            else:
                return JsonResponse({'success': False, 'error': 'Not following this user'})
                
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'User not found'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    else:
        # Handle regular unfollow request
        if not username:
            return JsonResponse({'success': False, 'error': 'Username is required'})
        
        user_to_unfollow = get_object_or_404(User, username=username)
        
        if request.user.id != user_to_unfollow.id:
            deleted_count, _ = Follow.objects.filter(
                follower_id=request.user.id,
                following=user_to_unfollow
            ).delete()
            
            if deleted_count > 0:
                # Get updated follower count
                follower_count = Follow.objects.filter(following=user_to_unfollow).count()
                return JsonResponse({
                    'success': True, 
                    'follower_count': follower_count
                })
        
        return JsonResponse({'success': False})

    # views.py - REPLACE these functions with the code below:
@login_required
def friend_suggestions(request):
    # Get current user
    current_user = request.user
    
    # Get users that current user is already following
    following_ids = Follow.objects.filter(
        follower=current_user
    ).values_list('following_id', flat=True)
    
    # Exclude self and already followed users
    suggestions = User.objects.exclude(
        id__in=following_ids
    ).exclude(
        id=current_user.id
    )
    
    # Add mutual friends count annotation
    suggestions = suggestions.annotate(
        followers_count=Count('followers'),
        following_count=Count('following')
    ).order_by('-followers_count')[:50]  # Get top 50 by followers
    
    # Add profile picture and mutual friends count for each suggestion
    for user in suggestions:
        # Count mutual friends
        current_following = set(following_ids)
        user_followers = set(Follow.objects.filter(
            following=user
        ).values_list('follower_id', flat=True))
        
        mutual_friends = current_following.intersection(user_followers)
        user.mutual_friends_count = len(mutual_friends)
        
        # Get profile picture from the Profile model
        try:
            profile = Profile.objects.get(user=user)
            user.profile_picture = profile.profile_pic  # Field name is profile_pic
        except Profile.DoesNotExist:
            user.profile_picture = None
    
    # Sort by mutual friends count (descending)
    suggestions = sorted(suggestions, key=lambda x: x.mutual_friends_count, reverse=True)
    
    # Pagination
    paginator = Paginator(suggestions, 10)  # Show 10 suggestions per page
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'suggestions': page_obj,
        'following_ids': list(following_ids),
    }
    
    return render(request, 'friend_suggestions.html', context)
    
@login_required
def api_followers(request, username):
    """API endpoint to get REAL followers list"""
    user = get_object_or_404(User, username=username)
    
    # Get all users who are following this user
    # Using your Follow model: follower follows following
    follower_relations = Follow.objects.filter(following=user).select_related('follower')
    
    followers_data = []
    for relation in follower_relations:
        follower = relation.follower
        # Get profile picture URL if exists
        profile_pic_url = None
        try:
            if follower.profile.profile_pic:
                profile_pic_url = follower.profile.profile_pic.url
        except:
            pass
        
        followers_data.append({
            'username': follower.username,
            'full_name': follower.get_full_name() or follower.username,
            'profile_pic': profile_pic_url
        })
    
    return JsonResponse({
        'followers': followers_data,
        'count': len(followers_data)
    })

@login_required
def api_following(request, username):
    """API endpoint to get REAL following list"""
    user = get_object_or_404(User, username=username)
    
    # Get all users this user is following
    # Using your Follow model: follower follows following
    following_relations = Follow.objects.filter(follower=user).select_related('following')
    
    following_data = []
    for relation in following_relations:
        following_user = relation.following
        # Get profile picture URL if exists
        profile_pic_url = None
        try:
            if following_user.profile.profile_pic:
                profile_pic_url = following_user.profile.profile_pic.url
        except:
            pass
        
        following_data.append({
            'username': following_user.username,
            'full_name': following_user.get_full_name() or following_user.username,
            'profile_pic': profile_pic_url
        })
    
    return JsonResponse({
        'following': following_data,
        'count': len(following_data)
    })

# Registration View
# Registration View
def register_view(request):
    if request.method == 'POST':
        # Get form data
        first_name = request.POST['first_name'].strip()
        last_name = request.POST['last_name'].strip()
        username = request.POST['username'].strip()
        email = request.POST['email'].strip()
        password = request.POST['password']
        confirm_password = request.POST['confirm_password']
        
        # Validate required fields
        if not first_name or not last_name:
            messages.error(request, "First name and last name are required!")
            return redirect('register')
        
        # Password validation
        if password != confirm_password:
            messages.error(request, "Passwords don't match!")
            return redirect('register')
        
        if len(password) < 6:
            messages.error(request, "Password must be at least 6 characters!")
            return redirect('register')
        
        # Check if username already exists
        if User.objects.filter(username=username).exists():
            messages.error(request, "Username already exists!")
            return redirect('register')
        
        # Check if email already registered
        if User.objects.filter(email=email).exists():
            messages.error(request, "Email already registered!")
            return redirect('register')
        
        try:
            # Create user with first and last name
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name
            )
            
            # Log the user in
            login(request, user)
            
            # Show welcome message
            messages.success(request, f"Welcome {first_name}! Your account has been created.")
            
            return redirect('home')
            
        except Exception as e:
            messages.error(request, f"An error occurred: {str(e)}")
            return redirect('register')
    
    return render(request, 'register.html')
# Check username availability (AJAX)
def check_username(request):
    username = request.GET.get('username', '').strip()
    
    if not username:
        return JsonResponse({'available': False})
    
    # Check if username exists
    exists = User.objects.filter(username__iexact=username).exists()
    
    # Also check if username meets requirements
    is_valid = len(username) >= 3 and re.match(r'^[a-zA-Z0-9_]+$', username)
    
    return JsonResponse({
        'available': not exists and is_valid,
        'suggestions': get_username_suggestions(username) if exists else []
    })

def get_username_suggestions(username):
    """Generate username suggestions"""
    suggestions = []
    base = re.sub(r'[^a-zA-Z0-9_]', '', username)
    
    if len(base) < 3:
        return suggestions
    
    # Add numbers
    for i in range(1, 10):
        suggestion = f"{base}{i}"
        if not User.objects.filter(username__iexact=suggestion).exists():
            suggestions.append(suggestion)
        if len(suggestions) >= 3:
            break
    
    # Add underscore
    suggestion = f"{base}_"
    if not User.objects.filter(username__iexact=suggestion).exists():
        suggestions.append(suggestion)
    
    return suggestions[:3]

# Login View
# Login View
def login_view(request):
    if request.method == 'POST':
        username_or_email = request.POST.get('username_or_email', '').strip()
        password = request.POST.get('password', '')
        
        print(f"DEBUG: Login attempt with: {username_or_email}")
        
        # Check if input looks like an email
        if '@' in username_or_email and '.' in username_or_email:
            # Try to get user by email
            try:
                user = User.objects.get(email=username_or_email)
                username = user.username
                print(f"DEBUG: Found user by email: {username}")
            except User.DoesNotExist:
                print(f"DEBUG: No user found with email: {username_or_email}")
                messages.error(request, "Invalid email or password!")
                return redirect('login')
        else:
            # Treat as username
            username = username_or_email
            print(f"DEBUG: Treating as username: {username}")
        
        # Authenticate user
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            
            # Set session expiry if "remember me" is checked
            remember_me = request.POST.get('remember_me')
            if not remember_me:
                # Session expires when browser closes
                request.session.set_expiry(0)
            
            messages.success(request, f"Welcome back, {user.first_name or user.username}!")
            return redirect('home')
        else:
            messages.error(request, "Invalid username/email or password!")
    
    return render(request, 'login.html')


# Edit Post
@login_required
def edit_post(request, post_id):
    if request.method == 'POST':
        post = get_object_or_404(Post, id=post_id)
        
        # Check if user owns the post
        if post.user != request.user:
            return JsonResponse({
                'success': False, 
                'error': 'You can only edit your own posts'
            })
        
        content = request.POST.get('content', '').strip()
        
        if not content:
            return JsonResponse({
                'success': False, 
                'error': 'Post content cannot be empty'
            })
        
        if len(content) > 1000:
            return JsonResponse({
                'success': False, 
                'error': 'Post content cannot exceed 1000 characters'
            })
        
        # Update post
        post.content = content
        post.save()
        
        # Return formatted content for display
        from django.utils.html import linebreaks
        formatted_content = linebreaks(content)
        
        return JsonResponse({
            'success': True,
            'content': formatted_content,
            'message': 'Post updated successfully'
        })
    
    return JsonResponse({'success': False, 'error': 'Invalid request'})
    

# Logout View
@login_required
def logout_view(request):
    logout(request)
    return redirect('login')

# Home View (News Feed)@login_required
def home_view(request):
    """
    Home page - shows visitor landing page for non-logged in users
    Shows news feed for logged in users
    """
    
    # For non-logged in users, show visitor homepage
    if not request.user.is_authenticated:
        # Show recent public posts
        public_posts = Post.objects.all().order_by('-created_at')[:10]
        
        # Get total user count for stats
        total_users = User.objects.count()
        total_posts = Post.objects.count()
        
        # Get some sample users for display
        sample_users = User.objects.order_by('-date_joined')[:6]
        
        return render(request, 'visitor_home.html', {
            'public_posts': public_posts,
            'total_users': total_users,
            'total_posts': total_posts,
            'sample_users': sample_users
        })
    
    # For logged in users (existing code)
    # Get posts from users you follow
    following_ids = Follow.objects.filter(follower_id=request.user.id).values_list('following_id', flat=True)
    
    # Get posts from users you follow plus your own posts
    posts = Post.objects.filter(
        Q(user_id=request.user.id) | Q(user_id__in=following_ids)
    ).order_by('-created_at')
    
    # Get user suggestions (users not followed by current user)
    followed_user_ids = Follow.objects.filter(follower_id=request.user.id).values_list('following_id', flat=True)
    suggestions = User.objects.exclude(
        Q(id=request.user.id) | 
        Q(id__in=followed_user_ids)
    ).order_by('?')[:5]  # Random 5 users
    
    # Get follower and following counts for current user
    follower_count = Follow.objects.filter(following=request.user).count()
    following_count = Follow.objects.filter(follower=request.user).count()
    
    return render(request, 'home.html', {
        'posts': posts,
        'suggestions': suggestions,
        'follower_count': follower_count,
        'following_count': following_count
    })
# views.py
def share_post(request, post_id):
    if request.method == 'POST':
        post = get_object_or_404(Post, id=post_id)
        post.share_count += 1
        post.save()
        return JsonResponse({'success': True, 'share_count': post.share_count})
# Create Post
@login_required
def create_post(request):
    if request.method == 'POST':
        content = request.POST.get('content', '').strip()
        if content:
            try:
                post = Post.objects.create(user=request.user, content=content)
                return JsonResponse({'success': True, 'post_id': post.id})
            except Exception as e:
                return JsonResponse({'success': False, 'error': str(e)})
        else:
            return JsonResponse({'success': False, 'error': 'Content cannot be empty'})
    return JsonResponse({'success': False, 'error': 'Invalid request method'})

# Profile View# In your profile_view function - make sure it matches this:
@login_required
def profile_view(request, username):
    user = get_object_or_404(User, username=username)
    posts = Post.objects.filter(user=user).order_by('-created_at')
    
    # Add comment counts to each post
    for post in posts:
        post.comment_count_value = Comment.objects.filter(post=post).count()
    
    is_following = Follow.objects.filter(follower=request.user, following=user).exists()
    
    # Get follower and following counts - MUST USE THE SAME LOGIC AS API
    follower_count = Follow.objects.filter(following=user).count()
    following_count = Follow.objects.filter(follower=user).count()
    
    return render(request, 'profile.html', {
        'profile_user': user,
        'posts': posts,
        'is_following': is_following,
        'follower_count': follower_count,
        'following_count': following_count
    })


# Edit Profile@login_required
def edit_profile(request):
    if request.method == 'POST':
        profile = request.user.profile
        profile.bio = request.POST.get('bio', '')
        
        # ========== REPLACE THIS SECTION (lines 6-29) ==========
        # Handle profile picture upload with cropping and compression
        if 'profile_pic' in request.FILES:
            uploaded_file = request.FILES['profile_pic']
            
            # Validate file size (max 2MB)
            if uploaded_file.size > 2 * 1024 * 1024:
                messages.error(request, "Image file too large ( > 2MB )")
                return redirect('edit_profile')
            
            # Validate file type
            valid_extensions = ['jpg', 'jpeg', 'png', 'gif']
            extension = uploaded_file.name.split('.')[-1].lower()
            if extension not in valid_extensions:
                messages.error(request, "Unsupported file format. Please upload JPG, PNG, or GIF.")
                return redirect('edit_profile')
            
            # ===== ADD COMPRESSION AND CROPPING HERE =====
            try:
                # First check if it's a cropped image (from our cropping feature)
                # If the form has cropped_image field (base64 data URL)
                if 'cropped_image' in request.POST and request.POST['cropped_image']:
                    import base64
                    from django.core.files.base import ContentFile
                    
                    # Get base64 image data
                    image_data = request.POST['cropped_image']
                    
                    # Remove data URL prefix if present
                    if ',' in image_data:
                        image_data = image_data.split(',')[1]
                    
                    # Decode base64
                    image_binary = base64.b64decode(image_data)
                    
                    # Create a file from the binary data
                    from io import BytesIO
                    from PIL import Image
                    
                    # Open image with PIL
                    img = Image.open(BytesIO(image_binary))
                    
                    # Convert to RGB if necessary
                    if img.mode in ('RGBA', 'LA', 'P'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img = background
                    
                    # Create circular mask for profile picture
                    mask = Image.new('L', img.size, 0)
                    draw = ImageDraw.Draw(mask)
                    draw.ellipse((0, 0) + img.size, fill=255)
                    
                    # Apply circular mask
                    output = Image.new('RGB', img.size, (255, 255, 255))
                    output.paste(img, mask=mask)
                    
                    # Save as JPEG
                    output_io = BytesIO()
                    output.save(output_io, format='JPEG', quality=90)
                    output_io.seek(0)
                    
                    # Generate unique filename
                    import uuid
                    filename = f"profile_pics/{uuid.uuid4()}.jpg"
                    
                    # Save the file
                    profile.profile_pic.save(filename, ContentFile(output_io.read()), save=False)
                    
                else:
                    # If no cropped image, compress the uploaded file
                    compressed_file = compress_image(uploaded_file)
                    
                    # Generate unique filename
                    import uuid
                    filename = f"profile_pics/{uuid.uuid4()}.jpg"
                    
                    # Save the compressed file
                    profile.profile_pic.save(filename, compressed_file, save=False)
                    
            except Exception as e:
                # If cropping/compression fails, save original
                print(f"Error processing image: {e}")
                profile.profile_pic = uploaded_file
            # ===== END OF ADDED CODE =====
        
        profile.save()
        
        # Update username if changed
        if 'username' in request.POST:
            new_username = request.POST['username']
            if new_username != request.user.username:
                if not User.objects.filter(username=new_username).exists():
                    request.user.username = new_username
                    request.user.save()
                else:
                    messages.error(request, "Username already exists!")
        
        # Update email if changed
        if 'email' in request.POST:
            new_email = request.POST['email']
            if new_email != request.user.email:
                if not User.objects.filter(email=new_email).exists():
                    request.user.email = new_email
                    request.user.save()
                else:
                    messages.error(request, "Email already registered!")
        
        messages.success(request, "Profile updated successfully!")
        return redirect('profile', username=request.user.username)
    
    return render(request, 'edit_profile.html')
# Search Users
from django.db.models import Q

@login_required
def search_users(request):
    query = request.GET.get('q', '').strip()
    
    if query:
        # Search by username, first name, and last name
        users = User.objects.filter(
            Q(username__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query)
        ).exclude(id=request.user.id).order_by('-date_joined')[:50]
        
        # If query has multiple words, try to search for first name + last name combination
        query_parts = query.split()
        if len(query_parts) >= 2 and not users.exists():
            # Try searching for first name and last name combination
            users = User.objects.filter(
                Q(first_name__icontains=query_parts[0]) & 
                Q(last_name__icontains=' '.join(query_parts[1:])) |
                Q(username__icontains=query)
            ).exclude(id=request.user.id).order_by('-date_joined')[:50]
        
        # Add following status for each user
        users_with_status = []
        for user in users:
            is_following = Follow.objects.filter(
                follower_id=request.user.id, 
                following=user
            ).exists()
            
            users_with_status.append({
                'user': user,
                'is_following': is_following
            })
        
        # Get popular users for suggestions when no results
        popular_users = User.objects.annotate(
            follower_count=Count('followers')
        ).order_by('-follower_count', '-date_joined')[:10]
        
        # Get recently active users
        recent_users = User.objects.order_by('-last_login')[:20]
        
    else:
        users_with_status = []
        popular_users = User.objects.annotate(
            follower_count=Count('followers')
        ).order_by('-follower_count', '-date_joined')[:10]
        recent_users = User.objects.order_by('-last_login')[:20]
    
    return render(request, 'search.html', {
        'users': users_with_status, 
        'query': query,
        'popular_users': popular_users,
        'recent_users': recent_users
    })

# Send Message
@login_required
def send_message(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        receiver_username = data.get('receiver')
        content = data.get('content')
        
        receiver = get_object_or_404(User, username=receiver_username)
        
        Message.objects.create(
            sender=request.user,
            receiver=receiver,
            content=content
        )
        
        return JsonResponse({'success': True})
    
    return JsonResponse({'success': False})

# Get Messages
@login_required
def get_messages(request, username):
    other_user = get_object_or_404(User, username=username)
    
    messages = Message.objects.filter(
        (Q(sender=request.user) & Q(receiver=other_user)) |
        (Q(sender=other_user) & Q(receiver=request.user))
    ).order_by('timestamp')
    
    # Mark as read
    Message.objects.filter(sender=other_user, receiver=request.user, is_read=False).update(is_read=True)
    
    messages_data = []
    for msg in messages:
        messages_data.append({
            'id': msg.id,
            'sender': msg.sender.username,
            'content': msg.content,
            'timestamp': msg.timestamp.strftime('%H:%M'),
            'is_me': msg.sender == request.user
        })
    
    return JsonResponse({'messages': messages_data})
# Like Post
@login_required
def like_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    
    like, created = Like.objects.get_or_create(user=request.user, post=post)
    
    if not created:
        like.delete()
        return JsonResponse({'liked': False, 'count': post.like_count()})
    else:
        # Create notification for post owner when someone likes the post
        if request.user != post.user:
            Notification.objects.create(
                recipient=post.user,
                actor=request.user,
                type='like',
                target_post=post
            )
    
    return JsonResponse({'liked': True, 'count': post.like_count()})

# Add Comment
@login_required
def add_comment(request, post_id):
    if request.method == 'POST':
        post = get_object_or_404(Post, id=post_id)
        content = request.POST.get('content', '').strip()
        
        if content:
            comment = Comment.objects.create(
                user=request.user,
                post=post,
                content=content
            )
            
            # Create notification for post owner when someone comments
            if post.user != request.user:
                Notification.objects.create(
                    recipient=post.user,
                    actor=request.user,
                    type='comment',
                    target_post=post,
                    target_comment=comment
                )
            
            return JsonResponse({
                'success': True,
                'comment': {
                    'id': comment.id,
                    'user': comment.user.username,
                    'content': comment.content,
                    'created_at': comment.created_at.strftime('%H:%M')
                }
            })
    
    return JsonResponse({'success': False})

@login_required
def get_comments(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    comments = Comment.objects.filter(post=post).order_by('created_at')
    
    comments_data = []
    for comment in comments:
        # Get profile picture URL or use default
        if comment.user.profile.profile_pic:
            profile_pic_url = comment.user.profile.profile_pic.url
        else:
            profile_pic_url = '/static/default_profile.png'  # Or a placeholder URL
        
        comments_data.append({
            'id': comment.id,
            'user': comment.user.username,
            'content': comment.content,
            'created_at': comment.created_at.strftime('%H:%M'),
            'profile_pic': profile_pic_url
        })
    
    return JsonResponse({'comments': comments_data})

# Change Password
@login_required
def change_password(request):
    if request.method == 'POST':
        old_password = request.POST['old_password']
        new_password = request.POST['new_password']
        confirm_password = request.POST['confirm_password']
        
        if not request.user.check_password(old_password):
            messages.error(request, "Old password is incorrect!")
            return redirect('edit_profile')
        
        if new_password != confirm_password:
            messages.error(request, "New passwords don't match!")
            return redirect('edit_profile')
        
        request.user.set_password(new_password)
        request.user.save()
        
        # Re-login user
        login(request, request.user)
        messages.success(request, "Password changed successfully!")
        return redirect('profile', username=request.user.username)
    
    return redirect('edit_profile')
@login_required
def delete_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    
    if post.user == request.user:
        post.delete()
        return JsonResponse({'success': True})
    
    return JsonResponse({'success': False})


from django.core.mail import send_mail
from django.utils.crypto import get_random_string

def forgot_password(request):
    if request.method == 'POST':
        email = request.POST['email']
        
        try:
            user = User.objects.get(email=email)
            # Generate temporary password
            temp_password = get_random_string(8)
            user.set_password(temp_password)
            user.save()
            
            # Send email
            send_mail(
                'Password Reset Request',
                f'Your temporary password is: {temp_password}\nPlease change it after login.',
                'noreply@socialapp.com',
                [email],
                fail_silently=False,
            )
            
            messages.success(request, 'Temporary password sent to your email!')
            return redirect('login')
            
        except User.DoesNotExist:
            messages.error(request, 'Email not found!')
    
    return render(request, 'forgot_password.html')


# Messages Page
@login_required
def messages_view(request):
    # Get all users you've exchanged messages with
    sent_users = Message.objects.filter(sender=request.user).values_list('receiver', flat=True).distinct()
    received_users = Message.objects.filter(receiver=request.user).values_list('sender', flat=True).distinct()
    
    # Combine and get unique users
    all_user_ids = set(list(sent_users) + list(received_users))
    conversations = []
    
    for user_id in all_user_ids:
        try:
            user = User.objects.get(id=user_id)
            
            # Get last message
            last_message = Message.objects.filter(
                (Q(sender=request.user) & Q(receiver=user)) |
                (Q(sender=user) & Q(receiver=request.user))
            ).order_by('-timestamp').first()
            
            # Count unread messages
            unread_count = Message.objects.filter(
                sender=user, receiver=request.user, is_read=False
            ).count()
            
            conversations.append({
                'user': user,
                'last_message': last_message.content if last_message else 'No messages yet',
                'last_time': last_message.timestamp if last_message else None,
                'unread_count': unread_count
            })
        except User.DoesNotExist:
            continue
    
    # Sort by last message time (most recent first)
    conversations.sort(key=lambda x: x['last_time'] if x['last_time'] else timezone.now(), reverse=True)
    
    return render(request, 'messages.html', {'conversations': conversations})

# Get user info for starting new conversation
@login_required
def get_user_info(request, username):
    try:
        user = User.objects.get(username=username)
        
        profile_pic = None
        if user.profile.profile_pic:
            profile_pic = user.profile.profile_pic.url
        
        return JsonResponse({
            'success': True,
            'user_id': user.id,
            'username': user.username,
            'profile_pic': profile_pic or 'https://via.placeholder.com/100'
        })
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found'})
    
# Notifications Page
@login_required
def notifications_view(request):
    # Get notifications for current user
    notifications = Notification.objects.filter(recipient=request.user).order_by('-created_at')
    
    # Get unread count
    unread_count = notifications.filter(is_read=False).count()
    
    # Filter by type if specified
    notif_type = request.GET.get('type')
    if notif_type == 'unread':
        notifications = notifications.filter(is_read=False)
    
    # Add profile picture URL to each notification
    for notification in notifications:
        try:
            profile = Profile.objects.get(user=notification.actor)
            notification.actor_profile_pic = profile.profile_pic.url if profile.profile_pic else None
        except Profile.DoesNotExist:
            notification.actor_profile_pic = None
    
    # Pagination
    from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
    page = request.GET.get('page', 1)
    paginator = Paginator(notifications, 20)
    
    try:
        notifications_page = paginator.page(page)
    except PageNotAnInteger:
        notifications_page = paginator.page(1)
    except EmptyPage:
        notifications_page = paginator.page(paginator.num_pages)
    
    return render(request, 'notifications.html', {
        'notifications': notifications_page,
        'unread_count': unread_count  # Add this line
    })

# Get Conversations (AJAX)
@login_required
def get_conversations(request):
    conversations = []
    # Similar logic to messages_view but return JSON
    return JsonResponse({'conversations': conversations})

# Get Unread Counts (AJAX)
@login_required
def get_unread_counts(request):
    unread_messages = Message.objects.filter(receiver=request.user, is_read=False).count()
    unread_notifications = Notification.objects.filter(user=request.user, is_read=False).count()
    
    return JsonResponse({
        'unread_messages': unread_messages,
        'unread_notifications': unread_notifications
    })

# Mark Messages as Read
@login_required
def mark_messages_read(request, username):
    other_user = get_object_or_404(User, username=username)
    Message.objects.filter(sender=other_user, receiver=request.user, is_read=False).update(is_read=True)
    return JsonResponse({'success': True})

# Mark Notification as Read
# Make sure your mark_notification_read looks like this:
@csrf_exempt
@login_required
def mark_notification_read(request, notification_id):
    """Mark a single notification as read"""
    try:
        notification = Notification.objects.get(id=notification_id, recipient=request.user)
        notification.is_read = True
        notification.save()
        return JsonResponse({'success': True})
    except Notification.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Notification not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# Mark All Notifications as Read
@csrf_exempt
@login_required
def mark_all_notifications_read(request):
    """Mark all notifications as read for current user"""
    if request.method == 'POST':
        try:
            updated_count = Notification.objects.filter(
                recipient=request.user, 
                is_read=False
            ).update(is_read=True)
            
            return JsonResponse({
                'success': True, 
                'updated_count': updated_count
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'})


@csrf_exempt
@login_required
def follow_user(request, username=None):
    """
    Combined function that handles both:
    1. AJAX requests (POST with user_id in JSON body)
    2. Regular requests (GET/POST with username in URL)
    """
    
    # Determine which type of request this is
    if request.method == 'POST' and request.content_type == 'application/json':
        # Handle AJAX request from friend suggestions
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            
            if not user_id:
                return JsonResponse({'success': False, 'error': 'User ID is required'})
            
            user_to_follow = User.objects.get(id=user_id)
            
            # Check if already following
            if Follow.objects.filter(follower=request.user, following=user_to_follow).exists():
                return JsonResponse({'success': False, 'error': 'Already following this user'})
            
            # Create follow relationship
            Follow.objects.create(follower=request.user, following=user_to_follow)
            
            # Create notification with new structure
            Notification.objects.create(
                recipient=user_to_follow,
                actor=request.user,
                type='follow'
            )
            
            return JsonResponse({'success': True})
            
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'User not found'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    else:
        # Handle regular request with username in URL
        if not username:
            return JsonResponse({'followed': False, 'error': 'Username is required'})
        
        user_to_follow = get_object_or_404(User, username=username)
        
        if request.user.id != user_to_follow.id:
            follow, created = Follow.objects.get_or_create(
                follower_id=request.user.id,
                following=user_to_follow
            )
            
            if not created:
                follow.delete()
                # Get updated follower count
                follower_count = Follow.objects.filter(following=user_to_follow).count()
                return JsonResponse({
                    'followed': False, 
                    'follower_count': follower_count
                })
            
            # Create notification with new structure
            Notification.objects.create(
                recipient=user_to_follow,
                actor=request.user,
                type='follow'
            )
            
            # Get updated follower count
            follower_count = Follow.objects.filter(following=user_to_follow).count()
            
            return JsonResponse({
                'followed': True, 
                'follower_count': follower_count
            })
        
        return JsonResponse({'followed': False})
    
# Check for new messages (for polling)
@login_required
def check_new_messages(request, username):
    other_user = get_object_or_404(User, username=username)
    last_message_id = request.GET.get('last_id', 0)
    
    # Get new messages since last check
    new_messages = Message.objects.filter(
        sender=other_user,
        receiver=request.user,
        id__gt=last_message_id,
        is_read=False
    ).order_by('timestamp')
    
    messages_data = []
    for msg in new_messages:
        messages_data.append({
            'id': msg.id,
            'sender': msg.sender.username,
            'content': msg.content,
            'timestamp': msg.timestamp.strftime('%H:%M'),
            'is_me': False
        })
    
    # Check if user is typing (you'll need to implement this storage)
    is_typing = False  # Implement typing status storage
    
    return JsonResponse({
        'new_messages': messages_data,
        'is_typing': is_typing
    })

# Typing indicator
@login_required
def typing_indicator(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        receiver_username = data.get('receiver')
        is_typing = data.get('is_typing', False)
        
        receiver = get_object_or_404(User, username=receiver_username)
        
        # Store typing status in database or cache
        # For now, we'll use Django cache
        from django.core.cache import cache
        cache_key = f'typing_{receiver.id}_{request.user.id}'
        cache.set(cache_key, is_typing, timeout=5)
        
        return JsonResponse({'success': True})
    
    return JsonResponse({'success': False})

# Get typing status
@login_required
def get_typing_status(request, username):
    other_user = get_object_or_404(User, username=username)
    
    from django.core.cache import cache
    cache_key = f'typing_{request.user.id}_{other_user.id}'
    is_typing = cache.get(cache_key, False)
    
    return JsonResponse({'is_typing': is_typing})


# Add these new functions at the end of views.py

@login_required
def post_detail_view(request, post_id):
    """View for individual post page"""
    post = get_object_or_404(Post, id=post_id)
    comments = Comment.objects.filter(post=post).order_by('created_at')
    
    # Check if user has liked the post
    user_has_liked = Like.objects.filter(user=request.user, post=post).exists()
    
    return render(request, 'post_detail.html', {
        'post': post,
        'comments': comments,
        'user_has_liked': user_has_liked
    })

@login_required
def accept_friend_request(request, username):
    """Accept friend request and create friendship"""
    user = get_object_or_404(User, username=username)
    
    # Here you would implement your friend request logic
    # For now, we'll create a follow relationship both ways
    Follow.objects.get_or_create(follower=request.user, following=user)
    Follow.objects.get_or_create(follower=user, following=request.user)
    
    # Delete the friend request notification
    Notification.objects.filter(
        recipient=request.user,
        actor=user,
        type='friend_request'
    ).delete()
    
    return JsonResponse({'success': True})

@login_required
def decline_friend_request(request, username):
    """Decline friend request"""
    user = get_object_or_404(User, username=username)
    
    # Delete the friend request notification
    Notification.objects.filter(
        recipient=request.user,
        actor=user,
        type='friend_request'
    ).delete()
    
    return JsonResponse({'success': True})

@login_required
def get_unread_counts(request):
    """Get unread message and notification counts"""
    unread_messages = Message.objects.filter(receiver=request.user, is_read=False).count()
    unread_notifications = Notification.objects.filter(recipient=request.user, is_read=False).count()
    
    return JsonResponse({
        'unread_messages': unread_messages,
        'unread_notifications': unread_notifications
    })

@login_required
def post_detail_view(request, post_id):
    """View for individual post page"""
    post = get_object_or_404(Post, id=post_id)
    comments = Comment.objects.filter(post=post).order_by('created_at')
    
    # Check if user has liked the post
    user_has_liked = Like.objects.filter(user=request.user, post=post).exists()
    
    # Use home.html template with just this post
    return render(request, 'home.html', {
        'posts': [post],  # Pass as list with single post
        'single_post_view': True,  # Add flag to indicate single post view
        'post': post,
        'comments': comments,
        'user_has_liked': user_has_liked
    })