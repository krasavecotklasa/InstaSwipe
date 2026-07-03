package com.instaswipe.repository;

import com.instaswipe.dto.UserSearchCriteria;
import com.instaswipe.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.support.PageableExecutionUtils;

import java.util.ArrayList;
import java.util.List;

@RequiredArgsConstructor
public class UserSearchRepositoryImpl implements UserSearchRepository{

    private final MongoTemplate mongoTemplate;

    @Override
    public Page<User> searchDiscoverable(UserSearchCriteria criteria, Pageable pageable) {
        List<Criteria> filters = new ArrayList<>();

        filters.add(Criteria.where("enabled").is(true));
        filters.add(Criteria.where("profile.name").ne(null));
        filters.add(Criteria.where("profile.gender").ne(null));
        filters.add(Criteria.where("profile.birthDate").ne(null));
        filters.add(Criteria.where("profile.profilePictureUrl").ne(null));

        if (criteria.excludeUserId() != null) {
            filters.add(Criteria.where("_id").ne(criteria.excludeUserId()));
        }
        if (criteria.gender() != null) {
            filters.add(Criteria.where("profile.gender").is(criteria.gender()));
        }
        if (criteria.country() != null) {
            filters.add(Criteria.where("profile.country").is(criteria.country()));
        }
        if (criteria.interests() != null && !criteria.interests().isEmpty()) {
            filters.add(Criteria.where("profile.interests").in(criteria.interests()));
        }
        if (criteria.birthDateFrom() != null) {
            filters.add(Criteria.where("profile.birthDate").gte(criteria.birthDateFrom()));
        }
        if (criteria.birthDateTo() != null) {
            filters.add(Criteria.where("profile.birthDate").lte(criteria.birthDateTo()));
        }

        Query query = new Query(new Criteria().andOperator(filters.toArray(new Criteria[0])));
        query.with(pageable);

        List<User> users = mongoTemplate.find(query, User.class);
        return PageableExecutionUtils.getPage(
                users, pageable,
                () -> mongoTemplate.count(Query.of(query).limit(-1).skip(-1), User.class));
    }
}
