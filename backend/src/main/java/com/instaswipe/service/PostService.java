package com.instaswipe.service;

import lombok.RequiredArgsConstructor;

import org.springframework.web.multipart.MultipartFile;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

import com.instaswipe.event.ImageTarget;
import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.Post;
import com.instaswipe.model.User;
import com.instaswipe.repository.PostRepository;
import com.instaswipe.repository.UserRepository;

@Service
@RequiredArgsConstructor
public class PostService {
    private final PostRepository postRepository;
    private final MediaUploadService mediaUploadService;
    private final UserRepository userRepository;

    public Post createPost(String userId, String caption, MultipartFile file) {
        boolean hasFile = file != null && !file.isEmpty();
        boolean hasCaption = caption != null && !caption.isBlank();
        if (!hasFile && !hasCaption) {
            throw new InvalidRequestException("A post must have a caption or an image");
        }

        // Store the raw bytes and attach a PROCESSING placeholder. The post is saved
        // (so it has an id) before the image is enqueued, so the worker can find it.
        MediaUploadService.AcceptedImage accepted = hasFile ? mediaUploadService.accept(file, userId) : null;

        Post post = Post.builder()
                .userId(userId)
                .caption(caption)
                .media(accepted != null ? accepted.pendingMedia() : null)
                .build();

        Post saved = postRepository.save(post);

        if (accepted != null) {
            mediaUploadService.enqueue(accepted.rawKey(), userId, ImageTarget.POST, saved.getId(), null);
        }
        return saved;
    }

    public Post likePost(String postId, String userId) {
        Post post = postRepository.likePost(postId, userId);
        if (post == null) {
            throw new IllegalArgumentException("Post not found");
        }
        return post;
    }

    public Post unlikePost(String postId, String userId) {
        Post post = postRepository.unlikePost(postId, userId);
        if (post == null) {
            throw new IllegalArgumentException("Post not found");
        }
        return post;
    }

    public Page<Post> getPostsByUserId(String userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return postRepository.findByUserId(userId, pageable);
    }

    /**
     * Feed for the current user: posts authored by users they have liked (swipe-right set),
     * newest first. Empty liked set yields an empty page without hitting the posts collection.
     */
    public Page<Post> getFeed(String currentUserId, Pageable pageable) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Set<String> likedUserIds = currentUser.getLikedUserIds();
        if (likedUserIds == null || likedUserIds.isEmpty()) {
            return Page.empty(pageable);
        }

        Pageable sorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by("createdAt").descending());
        return postRepository.findByUserIdIn(likedUserIds, sorted);
    }
}
