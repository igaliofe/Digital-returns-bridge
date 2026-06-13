package com.drb.server.rest;

import com.drb.server.domain.User;
import com.drb.server.domain.enums.Role;
import com.drb.server.rest.dto.LoginRequest;
import com.drb.server.rest.dto.LoginResponse;
import com.drb.server.rest.exception.ExceptionMappers;
import com.drb.server.service.AuthService;
import com.drb.server.service.exception.ValidationException;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthResourceTest {

    @Mock
    private AuthService authService;

    @InjectMocks
    private AuthResource authResource;

    @Test
    void login_happyPath_returns200WithTokenAndUserDetails() {
        LoginRequest req = new LoginRequest();
        req.phoneNumber = "+1234567890";

        User user = new User();
        user.setId(1L);
        user.setFullName("John Doe");
        user.setRole(Role.SERVICE_REP);
        user.setPhoneNumber("+1234567890");

        when(authService.login("+1234567890")).thenReturn("test-token");
        when(authService.getByToken("test-token")).thenReturn(user);

        Response response = authResource.login(req);

        assertThat(response.getStatus()).isEqualTo(200);
        LoginResponse body = (LoginResponse) response.getEntity();
        assertThat(body.token).isEqualTo("test-token");
        assertThat(body.userId).isEqualTo(1L);
        assertThat(body.fullName).isEqualTo("John Doe");
        assertThat(body.role).isEqualTo("SERVICE_REP");
    }

    @Test
    void login_blankPhone_serviceThrowsValidation_mapperReturns400() {
        LoginRequest req = new LoginRequest();
        req.phoneNumber = "";

        when(authService.login("")).thenThrow(new ValidationException("PHONE_BLANK", "Phone number is blank"));

        assertThatThrownBy(() -> authResource.login(req))
            .isInstanceOf(ValidationException.class)
            .hasMessage("Phone number is blank");

        ExceptionMappers.ValidationMapper mapper = new ExceptionMappers.ValidationMapper();
        Response r = mapper.toResponse(new ValidationException("PHONE_BLANK", "Phone number is blank"));
        assertThat(r.getStatus()).isEqualTo(400);
    }

    @Test
    void logout_returns204() {
        Response response = authResource.logout("Bearer some-token");

        assertThat(response.getStatus()).isEqualTo(204);
        verify(authService).logout("some-token");
    }
}
