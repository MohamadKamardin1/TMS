package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.entity.AuditLog;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Read model of one audit entry for the Admin Audit Log screen.
 *
 * @param id         audit row id
 * @param actorId    acting user id (null for system actions)
 * @param actorName  display name of the actor, resolved at read time
 * @param action     stable action code (e.g. {@code ORDER_ESTIMATED})
 * @param entityType affected entity type (ORDER / INVOICE / USER)
 * @param entityId   affected entity's primary key
 * @param oldValues  JSON snapshot of the entity before the change
 * @param newValues  JSON snapshot of the entity after the change
 * @param timestamp  when the action happened
 */
public record AuditLogDTO(
        Long id,
        Long actorId,
        String actorName,
        String action,
        String entityType,
        Long entityId,
        Map<String, Object> oldValues,
        Map<String, Object> newValues,
        LocalDateTime timestamp) {

    public static AuditLogDTO from(AuditLog log, String actorName) {
        return new AuditLogDTO(
                log.getId(),
                log.getActorId(),
                actorName,
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getOldValues(),
                log.getNewValues(),
                log.getTimestamp());
    }
}
