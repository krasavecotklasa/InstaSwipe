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
import java.util.regex.Pattern;

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
        filters.add(Criteria.where("profile.profilePicture").ne(null));

        if (criteria.excludeUserIds() != null && !criteria.excludeUserIds().isEmpty()) {
            filters.add(Criteria.where("_id").nin(criteria.excludeUserIds()));
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

    @Override
    public Page<User> searchByDisplayName(String query, String excludeUserId, Pageable pageable) {
        List<Criteria> filters = new ArrayList<>();

        // Only visible, fully-onboarded users are searchable (same bar the public
        // profile endpoint enforces), so half-set-up accounts never surface.
        filters.add(Criteria.where("enabled").is(true));
        filters.add(Criteria.where("profile.gender").ne(null));
        filters.add(Criteria.where("profile.birthDate").ne(null));
        filters.add(Criteria.where("profile.profilePicture").ne(null));

        // Case-insensitive substring match on display name. Pattern.quote escapes any
        // regex metacharacters so the raw user input can't be interpreted as a regex.
        filters.add(Criteria.where("profile.name").regex(Pattern.quote(query), "i"));

        if (excludeUserId != null) {
            filters.add(Criteria.where("_id").ne(excludeUserId));
        }

        Query mongoQuery = new Query(new Criteria().andOperator(filters.toArray(new Criteria[0])));
        mongoQuery.with(pageable);

        List<User> users = mongoTemplate.find(mongoQuery, User.class);
        return PageableExecutionUtils.getPage(
                users, pageable,
                () -> mongoTemplate.count(Query.of(mongoQuery).limit(-1).skip(-1), User.class));
    }
}
