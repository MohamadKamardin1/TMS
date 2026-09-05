package com.amdevelopers.tms.repositories;

import com.amdevelopers.tms.entity.AuditLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    /** Most recent entries first, so the ledger reads top-down newest. */
    List<AuditLog> findAllByOrderByTimestampDesc();
}
