package com.drb.server.domain;

import com.drb.server.domain.enums.ReturnStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "status_history")
public class StatusHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "return_request_id")
    private ReturnRequest returnRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by_user_id")
    private User changedByUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "old_status")
    private ReturnStatus oldStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status")
    private ReturnStatus newStatus;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private LocalDateTime changedAt;

    @Column
    private String comment;

    @PrePersist
    void prePersist() { this.changedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ReturnRequest getReturnRequest() { return returnRequest; }
    public void setReturnRequest(ReturnRequest returnRequest) { this.returnRequest = returnRequest; }
    public User getChangedByUser() { return changedByUser; }
    public void setChangedByUser(User changedByUser) { this.changedByUser = changedByUser; }
    public ReturnStatus getOldStatus() { return oldStatus; }
    public void setOldStatus(ReturnStatus oldStatus) { this.oldStatus = oldStatus; }
    public ReturnStatus getNewStatus() { return newStatus; }
    public void setNewStatus(ReturnStatus newStatus) { this.newStatus = newStatus; }
    public LocalDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(LocalDateTime changedAt) { this.changedAt = changedAt; }
    public LocalDateTime getCreatedAt() { return changedAt; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}
