package com.instaswipe.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;

import com.instaswipe.service.PostService;
import com.instaswipe.service.MediaStorageService;
import com.instaswipe.service.ProfileService;

import com.instaswipe.model.Post;
import com.instaswipe.model.Media;
import com.instaswipe.dto.CreatePostRequest;
import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.PostResponse;
import com.instaswipe.dto.PublicProfileResponse;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {
    private final PostService postService;
    private final MediaStorageService mediaStorageService;
    private final ProfileService profileService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse createPost(
        @ModelAttribute CreatePostRequest request,
        @AuthenticationPrincipal String userId) {
        Post post = postService.createPost(userId, request.caption(), request.file());
        return toResponse(post, userId);
    }

    @GetMapping("/feed")
    public PageResponse<PostResponse> getFeed(
        @AuthenticationPrincipal String currentUserId,
        @PageableDefault(size = 20) Pageable pageable) {
        Page<Post> posts = postService.getFeed(currentUserId, pageable);
        return PageResponse.from(posts.map(post -> toResponse(post, currentUserId)));
    }

    @GetMapping("/user/{userId}")
    public Page<PostResponse> getUserPosts(
        @PathVariable String userId,
        @AuthenticationPrincipal String currentUserId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
        Page<Post> posts = postService.getPostsByUserId(userId, page, size);
        return posts.map(post -> toResponse(post, currentUserId));
    }

    @PostMapping("/{postId}/like")
    public ResponseEntity<PostResponse> likePost(
            @PathVariable String postId,
            @AuthenticationPrincipal String currentUserId) {

        Post updatedPost = postService.likePost(postId, currentUserId);
        return ResponseEntity.ok(toResponse(updatedPost, currentUserId));
    }

    @PostMapping("/{postId}/unlike")
    public ResponseEntity<PostResponse> unlikePost(
            @PathVariable String postId,
            @AuthenticationPrincipal String currentUserId) {

        Post updatedPost = postService.unlikePost(postId, currentUserId);
        return ResponseEntity.ok(toResponse(updatedPost, currentUserId));
    }

    private PostResponse toResponse(Post post, String currentUserId) {
        boolean likedByMe = post.getLikedBy() != null && post.getLikedBy().contains(currentUserId);
        
        // Ensure media URL is presigned before returning, preserving processing status
        Media media = post.getMedia();
        if (media != null && media.getUrl() != null) {
            media = Media.builder()
                    .type(media.getType())
                    .filename(media.getFilename())
                    .size(media.getSize())
                    .url(mediaStorageService.ensurePresignedUrl(media.getUrl()))
                    .status(media.getStatus())
                    .build();
        }

        String displayName = null;
        String profilePictureUrl = null;
        try {
            PublicProfileResponse author = profileService.getPublicProfile(currentUserId, post.getUserId());
            displayName = author.displayName();
            profilePictureUrl = author.profilePictureUrl();
        } catch (IllegalArgumentException e) {
            // profile not available or not discoverable - leave author fields null
        }

        return PostResponse.builder()
            .id(post.getId())
            .userId(post.getUserId())
            .displayName(displayName)
            .profilePictureUrl(profilePictureUrl)
            .caption(post.getCaption())
            .likeCount(post.getLikedBy() == null ? 0 : post.getLikedBy().size())
            .media(media)
            .createdAt(post.getCreatedAt())
            .likedByMe(likedByMe)
            .build();
    }
}
