package com.instaswipe.dto;

import java.time.Instant;
import java.util.Map;

public record StatusResponse(
    String status,
    Map<String, String> components,
    Instant checkedAt
) {}
