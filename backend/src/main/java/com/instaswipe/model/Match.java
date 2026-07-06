package com.instaswipe.model;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "matches")
public class Match {

    /** Deterministic id: userOneId + "_" + userTwoId (participants sorted). */
    @Id
    private String id;

    /** Lexicographically smaller of the two user ids. */
    @Indexed
    private String userOneId;

    /** Lexicographically larger of the two user ids. */
    @Indexed
    private String userTwoId;

    private Instant createdAt;
}
