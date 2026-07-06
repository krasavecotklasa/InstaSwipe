package com.instaswipe.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "messages")
@CompoundIndexes({
    @CompoundIndex(name = "chatroom_timestamp_idx", def = "{'chatRoomId': 1, 'timestamp': -1}")
})
public class Message {

    @Id
    private String id;
    
    private String chatRoomId;
    private String senderId;
    private String recipientId;
    
    private String content;
    
    @CreatedDate
    private Instant timestamp;
    
    @Builder.Default
    @JsonProperty("isRead")
    private boolean isRead = false;
}
