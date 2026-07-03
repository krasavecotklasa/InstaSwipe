package com.instaswipe.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;

import com.instaswipe.service.PostService;

import jakarta.validation.Valid;

import com.instaswipe.model.Post;
import com.instaswipe.dto.CreateMediaPostRequest;
import com.instaswipe.dto.CreateTextPostRequest;
import com.instaswipe.dto.PostResponse;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {
    private final PostService postService;

    @PostMapping(value = "/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse uploadMedia(
        @Valid @ModelAttribute CreateMediaPostRequest request,
        @AuthenticationPrincipal String userId) {
        Post post = postService.createMediaPost(userId, request.caption(), request.file());
        return toResponse(post, userId);
    }

    @PostMapping(value = "/text")
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse uploadText(
        @Valid @ModelAttribute CreateTextPostRequest request,
        @AuthenticationPrincipal String userId) {
        Post post = postService.createTextPost(userId, request.caption());
        return toResponse(post, userId);
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

        return PostResponse.builder()
            .id(post.getId())
            .userId(post.getUserId())
            .caption(post.getCaption())
            .likeCount(post.getLikedBy() == null ? 0 : post.getLikedBy().size())
            .media(post.getMedia())
            .createdAt(post.getCreatedAt())
            .likedByMe(likedByMe)
            .build();
    }
}
