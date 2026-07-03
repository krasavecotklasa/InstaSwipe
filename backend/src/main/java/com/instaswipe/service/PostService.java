package com.instaswipe.service;

import lombok.RequiredArgsConstructor;

import org.springframework.web.multipart.MultipartFile;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.Post;
import com.instaswipe.model.Media;
import com.instaswipe.repository.PostRepository;

@Service
@RequiredArgsConstructor
public class PostService {
    private final PostRepository postRepository;
    private final MediaUploadService mediaUploadService;

    public Post createPost(String userId, String caption, MultipartFile file) {
        boolean hasFile = file != null && !file.isEmpty();
        boolean hasCaption = caption != null && !caption.isBlank();
        if (!hasFile && !hasCaption) {
            throw new InvalidRequestException("A post must have a caption or an image");
        }

        Media media = hasFile ? mediaUploadService.storeImage(file, userId) : null;

        Post post = Post.builder()
                .userId(userId)
                .caption(caption)
                .media(media)
                .build();

        return postRepository.save(post);
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
}
