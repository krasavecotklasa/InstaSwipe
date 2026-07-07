package com.instaswipe.repository;

import com.instaswipe.model.Match;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MatchRepository extends MongoRepository<Match, String>, MatchUpsertRepository {

    /** Matches where the given id is either participant. Call with the same id twice. */
    Page<Match> findByUserOneIdOrUserTwoId(String userOneId, String userTwoId, Pageable pageable);
}
