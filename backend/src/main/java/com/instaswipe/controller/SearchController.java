package com.instaswipe.controller;

import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.PublicProfileResponse;
import com.instaswipe.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final ProfileService profileService;

    /**
     * Plain people-search by display name. Separate from {@code /api/discovery},
     * which is the matching feed and deliberately hides already liked/passed users.
     */
    @GetMapping("/profiles")
    public ResponseEntity<PageResponse<PublicProfileResponse>> searchProfiles(
            @AuthenticationPrincipal String requesterId,
            @RequestParam("q") String query,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(profileService.searchProfiles(requesterId, query, pageable));
    }
}
