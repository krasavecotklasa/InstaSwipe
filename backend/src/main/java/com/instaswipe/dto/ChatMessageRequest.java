package com.instaswipe.dto;

import lombok.Data;

@Data
public class ChatMessageRequest {
    private String chatRoomId;
    private String senderId;
    private String recipientId;
    private String content;
}
