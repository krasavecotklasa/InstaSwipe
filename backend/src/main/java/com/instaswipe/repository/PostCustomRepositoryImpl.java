package com.instaswipe.repository;

import com.instaswipe.model.Post;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

@RequiredArgsConstructor
public class PostCustomRepositoryImpl implements PostCustomRepository {

    private final MongoTemplate mongoTemplate;

    @Override
    public Post likePost(String postId, String userId) {
        Query query = new Query(Criteria.where("id").is(postId));
        // $addToSet adds to the array ONLY if it doesn't already exist (no duplicates)
        Update update = new Update().addToSet("likedBy", userId);

        return mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                Post.class
        );
    }

    @Override
    public Post unlikePost(String postId, String userId) {
        Query query = new Query(Criteria.where("id").is(postId));
        // $pull removes all instances of the value from the array
        Update update = new Update().pull("likedBy", userId);

        return mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                Post.class
        );
    }
}
