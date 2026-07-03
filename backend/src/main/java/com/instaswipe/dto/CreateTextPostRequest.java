package com.instaswipe.dto;

import jakarta.validation.constraints.NotNull;

public record CreateTextPostRequest (
    @NotNull String caption
) {}
