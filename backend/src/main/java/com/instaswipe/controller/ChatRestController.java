package com.instaswipe.controller;

import com.instaswipe.model.Message;
import com.instaswipe.repository.MessageRepository;
import com.instaswipe.service.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class ChatRestController {

    private final MessageRepository messageRepository;
    private final MatchService matchService;

    @GetMapping("/{matchId}/messages")
    public ResponseEntity<Page<Message>> getChatHistory(
            @PathVariable String matchId,
            @AuthenticationPrincipal String currentUserId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        // Only participants may read a conversation. A non-participant and a non-existent match
        // both fail here, so this does not leak which match ids exist.
        if (!matchService.isParticipant(currentUserId, matchId)) {
            throw new AccessDeniedException("You are not a participant of this match");
        }

        // We use the compound index on (chatRoomId, timestamp) we created earlier
        Page<Message> messagePage = messageRepository.findByChatRoomIdOrderByTimestampDesc(
                matchId,
                PageRequest.of(page, size)
        );

        return ResponseEntity.ok(messagePage);
    }
}
