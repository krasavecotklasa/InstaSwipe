package com.instaswipe.repository;

import com.instaswipe.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

@RequiredArgsConstructor
public class UserMatchRepositoryImpl implements UserMatchRepository {

    private final MongoTemplate mongoTemplate;

    @Override
    public User recordLike(String userId, String targetUserId) {
        return addToSet(userId, "likedUserIds", targetUserId);
    }

    @Override
    public User recordPass(String userId, String targetUserId) {
        return addToSet(userId, "passedUserIds", targetUserId);
    }

    /**
     * Atomically appends {@code targetUserId} to the given set field via
     * {@code $addToSet} (no duplicates, single round trip, no lost-update race).
     * Returns the updated document, or {@code null} when no user matches the id
     * — the signal MatchService turns into a 404.
     */
    private User addToSet(String userId, String field, String targetUserId) {
        Query query = new Query(Criteria.where("id").is(userId));
        Update update = new Update().addToSet(field, targetUserId);

        return mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                User.class
        );
    }
}
