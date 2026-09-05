package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.AuditLogDTO;
import com.amdevelopers.tms.entity.AuditLog;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.repositories.AuditLogRepository;
import com.amdevelopers.tms.repositories.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read access to the audit trail. Entries are immutable once written; this
 * service only orders and filters them and resolves the actor's display name.
 */
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /**
     * Returns audit entries, newest first, narrowed by the optional filters.
     * Filtering is applied in memory; the volume of audit rows for this system is
     * modest and the trail is always read in full so a snapshot can be diffed.
     */
    @Transactional(readOnly = true)
    public List<AuditLogDTO> getAuditLogs(String action, String entityType, Long actorId, Long entityId) {
        List<AuditLog> logs = auditLogRepository.findAllByOrderByTimestampDesc();

        Map<Long, String> actorNames = resolveActorNames(logs);

        return logs.stream()
                .filter(log -> matchesIgnoreCase(action, log.getAction()))
                .filter(log -> matchesIgnoreCase(entityType, log.getEntityType()))
                .filter(log -> actorId == null || Objects.equals(actorId, log.getActorId()))
                .filter(log -> entityId == null || Objects.equals(entityId, log.getEntityId()))
                .map(log -> AuditLogDTO.from(log, actorNames.get(log.getActorId())))
                .toList();
    }

    private Map<Long, String> resolveActorNames(List<AuditLog> logs) {
        Set<Long> actorIds = logs.stream()
                .map(AuditLog::getActorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (actorIds.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(actorIds).stream()
                .collect(Collectors.toMap(User::getId, AuditLogService::displayName, (a, b) -> a));
    }

    private static String displayName(User user) {
        return user.getFullName() != null ? user.getFullName() : user.getUsername();
    }

    private static boolean matchesIgnoreCase(String filter, String value) {
        return filter == null || filter.isBlank() || filter.equalsIgnoreCase(value);
    }
}
