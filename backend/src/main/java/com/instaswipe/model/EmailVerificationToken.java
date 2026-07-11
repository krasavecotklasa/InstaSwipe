package com.instaswipe.model;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "email_verification_tokens")
public class EmailVerificationToken {

    @Id
    private String id;

    @Indexed
    private String email;

    @Indexed(unique = true)
    private String tokenHash;

    @Indexed(expireAfter = "0s")
    private Instant expiresAt;

    @Builder.Default
    private boolean used = false;

    @Builder.Default
    private int attempts = 0;

    @CreatedDate
    private Instant createdAt;
}
