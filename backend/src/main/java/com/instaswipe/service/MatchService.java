package com.instaswipe.service;

import com.instaswipe.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MatchService {
    private final MongoTemplate mongoTemplate;

    public String passPerson(String currentUserId, String targetUserId) {
        validateInteraction(currentUserId, targetUserId, "pass");

        Query query = Query.query(Criteria.where("_id").is(currentUserId));
        Update update = new Update().addToSet("passedUserIds", targetUserId);

        mongoTemplate.updateFirst(query, update, User.class);
        return "passed";
    }

    public String lovePerson(String currentUserId, String targetUserId) {
        validateInteraction(currentUserId, targetUserId, "love");

        Query query = Query.query(Criteria.where("_id").is(currentUserId));
        Update update = new Update().addToSet("likedUserIds", targetUserId);

        mongoTemplate.updateFirst(query, update, User.class);
        return "liked";
    }

    private void validateInteraction(String currentUserId, String targetUserId, String action) {
        if (currentUserId == null) {
            throw new IllegalArgumentException("Current user ID is required");
        }
        if (currentUserId.equals(targetUserId)) {
            throw new IllegalArgumentException(action.equals("pass") ? "Cannot pass yourself" : "Cannot like yourself");
        }
    }
}
