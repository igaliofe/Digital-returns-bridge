package com.drb.server.rest.security;

import com.drb.server.domain.User;
import com.drb.server.domain.enums.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class TokenStoreTest {

    private TokenStore tokenStore;
    private User user;

    @BeforeEach
    void setUp() {
        tokenStore = new TokenStore();
        user = new User();
        user.setId(1L);
        user.setPhoneNumber("0501234567");
        user.setFullName("Test User");
        user.setRole(Role.DRIVER);
    }

    @Test
    void issueReturnsNonBlankToken() {
        String token = tokenStore.issue(user);
        assertThat(token).isNotBlank();
    }

    @Test
    void lookupReturnsUserForValidToken() {
        String token = tokenStore.issue(user);
        assertThat(tokenStore.lookup(token)).isPresent().contains(user);
    }

    @Test
    void lookupReturnsEmptyForUnknownToken() {
        assertThat(tokenStore.lookup("unknown")).isEmpty();
    }

    @Test
    void lookupReturnsEmptyForNullToken() {
        assertThat(tokenStore.lookup(null)).isEmpty();
    }

    @Test
    void invalidateRemovesToken() {
        String token = tokenStore.issue(user);
        tokenStore.invalidate(token);
        assertThat(tokenStore.lookup(token)).isEmpty();
    }

    @Test
    void differentUsersGetDifferentTokens() {
        User user2 = new User();
        user2.setId(2L);
        user2.setPhoneNumber("0509999999");
        user2.setFullName("Other User");
        user2.setRole(Role.MANAGER);
        assertThat(tokenStore.issue(user)).isNotEqualTo(tokenStore.issue(user2));
    }
}
