package com.instaswipe.service;

import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.User;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MatchService {

    private final UserRepository userRepository;

    public String passPerson(String currentUserId, String targetUserId) {
        validateNotSelf(currentUserId, targetUserId, "pass");
        requireExists(userRepository.recordPass(currentUserId, targetUserId));
        return "passed";
    }

    public String lovePerson(String currentUserId, String targetUserId) {
        validateNotSelf(currentUserId, targetUserId, "like");
        requireExists(userRepository.recordLike(currentUserId, targetUserId));
        return "liked";
    }

    private void validateNotSelf(String currentUserId, String targetUserId, String verb) {
        if (currentUserId == null) {
            throw new InvalidRequestException("Current user ID is required");
        }
        if (currentUserId.equals(targetUserId)) {
            throw new InvalidRequestException("Cannot " + verb + " yourself");
        }
    }

    private void requireExists(User updatedUser) {
        if (updatedUser == null) {
            throw new IllegalArgumentException("Current user not found");
        }
    }
}
