package com.drb.server.rest;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Deque;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@Path("/debug/logs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DebugLogResource {

    private static final Logger LOG = Logger.getLogger("AndroidRemote");
    private static final Deque<LogEntry> BUFFER = new ConcurrentLinkedDeque<>();
    private static final int MAX = 500;

    @POST
    public Response receive(LogEntry entry) {
        Level level = "ERROR".equalsIgnoreCase(entry.level) ? Level.SEVERE
                    : "WARN".equalsIgnoreCase(entry.level)  ? Level.WARNING
                    : Level.INFO;
        LOG.log(level, "[ANDROID][{0}] {1}", new Object[]{entry.tag, entry.message});
        BUFFER.addFirst(entry);
        while (BUFFER.size() > MAX) BUFFER.pollLast();
        return Response.accepted().build();
    }

    @GET
    public Response list(@QueryParam("n") @DefaultValue("100") int n) {
        return Response.ok(BUFFER.stream().limit(n).collect(Collectors.toList())).build();
    }

    @DELETE
    public Response clear() {
        BUFFER.clear();
        return Response.noContent().build();
    }

    public static class LogEntry {
        public String level;
        public String tag;
        public String message;
        public String timestamp;
    }
}
