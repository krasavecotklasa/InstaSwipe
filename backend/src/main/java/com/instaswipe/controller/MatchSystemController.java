package com.instaswipe.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.instaswipe.model.User;
import com.instaswipe.repository.UserRepository;

import java.util.HashSet;

@RestController
@RequestMapping("api/matches")
@RequiredArgsConstructor
public class MatchSystemController {
    private final UserRepository userRepository;

    @PostMapping("/{userId}/pass") // change me!!!
    public ResponseEntity<String> passPerson(
            @PathVariable String userId,
            @AuthenticationPrincipal String currentUserId
    ) {
        if (currentUserId == null) return ResponseEntity.status(401).body("Unauthorized");
        if (currentUserId.equals(userId)) return ResponseEntity.badRequest().body("Cannot pass yourself");

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Current user not found"));

        if (currentUser.getPassedUserIds() == null) {
            currentUser.setPassedUserIds(new HashSet<>());
        }

        currentUser.getPassedUserIds().add(userId);
        userRepository.save(currentUser);

        return ResponseEntity.ok("passed");
    }

    @PostMapping("/{userId}/love") // change me!!!
    public ResponseEntity<String> lovePerson(
            @PathVariable String userId,
            @AuthenticationPrincipal String currentUserId
    ) {
        if (currentUserId == null) return ResponseEntity.status(401).body("Unauthorized");
        if (currentUserId.equals(userId)) return ResponseEntity.badRequest().body("Cannot pass yourself");

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Current user not found"));

        if (currentUser.getLikedUserIds() == null) {
            currentUser.setLikedUserIds(new HashSet<>());
        }

        currentUser.getLikedUserIds().add(userId);
        userRepository.save(currentUser);

        return ResponseEntity.ok("passed");
    }

}
