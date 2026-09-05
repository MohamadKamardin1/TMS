package com.amdevelopers.tms.entity;

import com.amdevelopers.tms.entity.converter.JsonMapConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Immutable, append-only record of a state-changing action on the system.
 *
 * <p>An audit row stores <em>who</em> (the acting user id), <em>what</em> (a
 * stable action code such as {@code ORDER_STATUS_CHANGED}), <em>on what</em>
 * (the affected entity type and id) and the before/after JSON snapshots of the
 * entity. Snapshots make the log resilient: they remain readable even if the
 * underlying record is later deleted or rewritten.
 *
 * <p>{@code actorId} is intentionally nullable — system-driven transitions
 * (e.g. an invoice auto-promoted to OVERDUE) have no human actor.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "audit_logs",
        indexes = {
                @Index(name = "idx_audit_entity", columnList = "entity_type, entity_id"),
                @Index(name = "idx_audit_actor", columnList = "actor_id"),
                @Index(name = "idx_audit_timestamp", columnList = "timestamp")
        })
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "action", nullable = false, length = 60)
    private String action;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Convert(converter = JsonMapConverter.class)
    @Column(name = "old_values", columnDefinition = "TEXT")
    private Map<String, Object> oldValues;

    @Convert(converter = JsonMapConverter.class)
    @Column(name = "new_values", columnDefinition = "TEXT")
    private Map<String, Object> newValues;

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    void stampIfAbsent() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}
