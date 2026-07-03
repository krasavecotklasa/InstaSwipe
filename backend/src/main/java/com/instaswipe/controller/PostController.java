package com.instaswipe.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
        return toResponse(post);
    }

    @PostMapping(value = "/text")
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse uploadText(
        @Valid @ModelAttribute CreateTextPostRequest request,
        @AuthenticationPrincipal String userId) {
        Post post = postService.createTextPost(userId, request.caption());
        return toResponse(post);
    }


    @GetMapping("/user/{userId}")
    public Page<PostResponse> getUserPosts(
        @PathVariable String userId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
        Page<Post> posts = postService.getPostsByUserId(userId, page, size);
        return posts.map(this::toResponse);
    }


    private PostResponse toResponse(Post post) {
        return PostResponse.builder()
            .id(post.getId())
            .userId(post.getUserId())
            .caption(post.getCaption())
            .likes(post.getLikes())
            .media(post.getMedia())
            .createdAt(post.getCreatedAt())
            .build();
    }
}
