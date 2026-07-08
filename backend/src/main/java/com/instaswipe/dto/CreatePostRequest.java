package com.instaswipe.dto;

import jakarta.validation.constraints.Size;
import org.springframework.web.multipart.MultipartFile;

/**
 * A post carries a caption, an image, or both. Both fields are optional here;
 * the service rejects the empty-empty case. @Size ignores null, so an image-only
 * post (no caption) still passes validation.
 */
public record CreatePostRequest(
    MultipartFile file,
    @Size(max = 500, message = "Caption cannot exceed 500 characters")
    String caption
) {}
