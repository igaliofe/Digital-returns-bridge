package com.drb.server.web;

import com.drb.server.domain.User;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.*;
import java.io.IOException;

@WebFilter("/*")
public class RoleAuthFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        String path = req.getRequestURI();
        String ctx = req.getContextPath();
        String appPath = path.startsWith(ctx) ? path.substring(ctx.length()) : path;

        if (!appPath.endsWith(".xhtml")
                || appPath.contains("/jakarta.faces.resource/")
                || appPath.endsWith("/login.xhtml")) {
            chain.doFilter(request, response);
            return;
        }

        HttpSession session = req.getSession(false);
        User user = session != null ? (User) session.getAttribute("loggedInUser") : null;

        if (user == null) {
            res.sendRedirect(ctx + "/login.xhtml");
            return;
        }

        chain.doFilter(request, response);
    }
}
