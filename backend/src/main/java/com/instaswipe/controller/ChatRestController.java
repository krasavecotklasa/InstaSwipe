package com.instaswipe.controller;

import com.instaswipe.model.Message;
import com.instaswipe.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class ChatRestController {

    private final MessageRepository messageRepository;

    @GetMapping("/{matchId}/messages")
    public ResponseEntity<Page<Message>> getChatHistory(
            @PathVariable String matchId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
            
        // We use the compound index on (chatRoomId, timestamp) we created earlier
        Page<Message> messagePage = messageRepository.findByChatRoomIdOrderByTimestampDesc(
                matchId, 
                PageRequest.of(page, size)
        );
        
        return ResponseEntity.ok(messagePage);
    }
}
