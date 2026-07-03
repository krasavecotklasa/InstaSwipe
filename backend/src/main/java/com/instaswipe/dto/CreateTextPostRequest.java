package com.instaswipe.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateTextPostRequest (
    @NotBlank String caption
) {}
