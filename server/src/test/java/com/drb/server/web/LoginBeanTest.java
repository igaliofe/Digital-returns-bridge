package com.drb.server.web;

import com.drb.server.domain.User;
import com.drb.server.domain.enums.Role;
import com.drb.server.service.AuthService;
import com.drb.server.service.exception.NotFoundException;
import jakarta.faces.application.FacesMessage;
import jakarta.faces.context.ExternalContext;
import jakarta.faces.context.FacesContext;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoginBeanTest {

    @Mock
    private AuthService authService;

    @InjectMocks
    private LoginBean loginBean;

    @Test
    void login_validPhone_setsSessionAndReturnsDashboard() throws Exception {
        User user = new User();
        user.setRole(Role.MANAGER);
        user.setFullName("Test Manager");

        FacesContext fc = mock(FacesContext.class);
        ExternalContext ec = mock(ExternalContext.class);
        HttpSession session = mock(HttpSession.class);
        when(fc.getExternalContext()).thenReturn(ec);
        when(ec.getSession(true)).thenReturn(session);

        loginBean.facesContextSupplier = () -> fc;

        when(authService.login("0501234567")).thenReturn("token-abc");
        when(authService.getByToken("token-abc")).thenReturn(user);

        loginBean.setPhoneNumber("0501234567");
        String nav = loginBean.login();

        assertThat(nav).contains("dashboard");
        verify(session).setAttribute("loggedInUser", user);
        verify(session).setAttribute("authToken", "token-abc");
    }

    @Test
    void login_unknownPhone_addsFacesMessageAndReturnsNull() {
        when(authService.login("bad-phone")).thenThrow(new NotFoundException("User not found"));

        FacesContext fc = mock(FacesContext.class);
        loginBean.facesContextSupplier = () -> fc;

        loginBean.setPhoneNumber("bad-phone");
        String nav = loginBean.login();

        assertThat(nav).isNull();
        verify(fc).addMessage(eq(null), any(FacesMessage.class));
    }
}
