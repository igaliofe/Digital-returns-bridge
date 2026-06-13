package com.drb.server.web;

import com.drb.server.domain.User;
import com.drb.server.domain.enums.Role;
import com.drb.server.service.AuthService;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.enterprise.context.RequestScoped;
import jakarta.faces.application.FacesMessage;
import jakarta.faces.context.FacesContext;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.servlet.http.HttpSession;
import java.util.function.Supplier;

@Named
@RequestScoped
public class LoginBean {

    @Inject
    private AuthService authService;

    private String phoneNumber;

    // package-private to allow test override without static mocking
    Supplier<FacesContext> facesContextSupplier = FacesContext::getCurrentInstance;

    protected FacesContext getFacesContext() {
        return facesContextSupplier.get();
    }

    public String login() {
        try {
            String token = authService.login(phoneNumber);
            User user = authService.getByToken(token);
            HttpSession session = (HttpSession)
                getFacesContext().getExternalContext().getSession(true);
            session.setAttribute("loggedInUser", user);
            session.setAttribute("authToken", token);

            if (user.getRole() == Role.WAREHOUSE) {
                return "/warehouse/receiving.xhtml?faces-redirect=true";
            }
            return "/dashboard.xhtml?faces-redirect=true";
        } catch (NotFoundException | ValidationException e) {
            getFacesContext().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Login failed", e.getMessage()));
            return null;
        }
    }

    public String logout() {
        FacesContext ctx = getFacesContext();
        HttpSession session = (HttpSession) ctx.getExternalContext().getSession(false);
        if (session != null) {
            String token = (String) session.getAttribute("authToken");
            if (token != null) {
                authService.logout(token);
            }
            session.invalidate();
        }
        return "/login.xhtml?faces-redirect=true";
    }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
}
