package com.instaswipe.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OfflineMessageEvent implements Serializable {
    private String messageId;
    private String chatRoomId;
    private String senderId;
    private String recipientId;
    private String content;
}
