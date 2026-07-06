package com.instaswipe.controller;

import com.instaswipe.dto.MatchResponse;
import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.SwipeResult;
import com.instaswipe.service.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    @PostMapping("/{userId}/pass")
    public ResponseEntity<SwipeResult> passPerson(
            @PathVariable String userId,
            @AuthenticationPrincipal String currentUserId
    ) {
        return ResponseEntity.ok(matchService.passPerson(currentUserId, userId));
    }

    @PostMapping("/{userId}/love")
    public ResponseEntity<SwipeResult> lovePerson(
            @PathVariable String userId,
            @AuthenticationPrincipal String currentUserId
    ) {
        return ResponseEntity.ok(matchService.lovePerson(currentUserId, userId));
    }

    @GetMapping
    public ResponseEntity<PageResponse<MatchResponse>> myMatches(
            @AuthenticationPrincipal String currentUserId,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return ResponseEntity.ok(matchService.listMatches(currentUserId, pageable));
    }
}
