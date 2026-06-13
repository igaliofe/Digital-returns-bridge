package com.drb.server.web;

import com.drb.server.domain.User;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.*;
import java.io.IOException;

@WebFilter("/faces/*")
public class RoleAuthFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        String path = req.getRequestURI();
        if (path.contains("/faces/login.xhtml")) {
            chain.doFilter(request, response);
            return;
        }

        HttpSession session = req.getSession(false);
        User user = session != null ? (User) session.getAttribute("loggedInUser") : null;

        if (user == null) {
            res.sendRedirect(req.getContextPath() + "/faces/login.xhtml");
            return;
        }

        chain.doFilter(request, response);
    }
}
