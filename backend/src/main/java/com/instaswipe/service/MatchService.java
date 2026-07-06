package com.instaswipe.service;

import com.instaswipe.model.User;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashSet;

@Service
@RequiredArgsConstructor
public class MatchService {
    private final UserRepository userRepository;

    public String passPerson(String currentUserId, String targetUserId) {
        validateInteraction(currentUserId, targetUserId, "pass");

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Current user not found"));

        if (currentUser.getPassedUserIds() == null) {
            currentUser.setPassedUserIds(new HashSet<>());
        }

        currentUser.getPassedUserIds().add(targetUserId);
        userRepository.save(currentUser);

        return "passed";
    }

    public String lovePerson(String currentUserId, String targetUserId) {
        validateInteraction(currentUserId, targetUserId, "love");

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Current user not found"));

        if (currentUser.getLikedUserIds() == null) {
            currentUser.setLikedUserIds(new HashSet<>());
        }

        currentUser.getLikedUserIds().add(targetUserId);
        userRepository.save(currentUser);

        return "liked";
    }

    private void validateInteraction(String currentUserId, String targetUserId, String action) {
        if (currentUserId == null) {
            throw new IllegalArgumentException("Current user ID is required");
        }
        if (currentUserId.equals(targetUserId)) {
            throw new IllegalArgumentException(action.equals("pass") ? "Cannot pass yourself" : "Cannot like yourself");
        }
    }
}
