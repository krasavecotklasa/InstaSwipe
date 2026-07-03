package com.instaswipe.dto;

import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.constraints.NotNull;

public record CreateMediaPostRequest (
    @NotNull MultipartFile file,
    String caption
) {}
