package com.instaswipe.repository;

import java.time.Instant;

import com.instaswipe.model.Match;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

@RequiredArgsConstructor
public class MatchUpsertRepositoryImpl implements MatchUpsertRepository {

    private final MongoTemplate mongoTemplate;

    @Override
    public boolean createIfAbsent(String matchId, String userOneId, String userTwoId) {
        Query query = new Query(Criteria.where("_id").is(matchId));
        Update update = new Update()
                .setOnInsert("userOneId", userOneId)
                .setOnInsert("userTwoId", userTwoId)
                .setOnInsert("createdAt", Instant.now());
        try {
            UpdateResult result = mongoTemplate.upsert(query, update, Match.class);
            return result.getUpsertedId() != null;
        } catch (DuplicateKeyException ex) {
            // Rare concurrent-insert race on the same _id: the other call won.
            return false;
        }
    }
}
