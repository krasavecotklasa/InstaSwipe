package com.instaswipe.service;

import com.instaswipe.dto.MatchResponse;
import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.SwipeResult;
import com.instaswipe.event.MatchCreatedEvent;
import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.Match;
import com.instaswipe.model.User;
import com.instaswipe.repository.MatchRepository;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MatchService {

    private final UserRepository userRepository;
    private final MatchRepository matchRepository;
    private final ApplicationEventPublisher eventPublisher;

    public SwipeResult passPerson(String currentUserId, String targetUserId) {
        validateNotSelf(currentUserId, targetUserId, "pass");
        requireExists(userRepository.recordPass(currentUserId, targetUserId));
        return SwipeResult.passed();
    }

    public SwipeResult lovePerson(String currentUserId, String targetUserId) {
        validateNotSelf(currentUserId, targetUserId, "like");
        requireExists(userRepository.recordLike(currentUserId, targetUserId));

        // Reciprocity: does the target already like the current user?
        if (!userRepository.existsByIdAndLikedUserIdsContains(targetUserId, currentUserId)) {
            return SwipeResult.liked();
        }

        boolean currentIsFirst = currentUserId.compareTo(targetUserId) < 0;
        String userOneId = currentIsFirst ? currentUserId : targetUserId;
        String userTwoId = currentIsFirst ? targetUserId : currentUserId;
        String matchId = userOneId + "_" + userTwoId;

        // Deterministic id + upsert => exactly one insert even under concurrent mutual likes.
        if (matchRepository.createIfAbsent(matchId, userOneId, userTwoId)) {
            eventPublisher.publishEvent(new MatchCreatedEvent(matchId, userOneId, userTwoId));
        }
        return SwipeResult.matched(matchId);
    }

    public PageResponse<MatchResponse> listMatches(String currentUserId, Pageable pageable) {
        Pageable effective = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<MatchResponse> page = matchRepository
                .findByUserOneIdOrUserTwoId(currentUserId, currentUserId, effective)
                .map(match -> toResponse(match, currentUserId));
        return PageResponse.from(page);
    }

    private MatchResponse toResponse(Match match, String currentUserId) {
        String otherUserId = match.getUserOneId().equals(currentUserId)
                ? match.getUserTwoId()
                : match.getUserOneId();
        return new MatchResponse(match.getId(), otherUserId, match.getCreatedAt());
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
