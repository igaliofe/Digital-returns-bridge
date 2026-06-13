package com.drb.server.service;

import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.WarehouseInspection;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.domain.enums.WarehouseDecision;
import com.drb.server.repository.ReturnRequestRepository;
import com.drb.server.repository.WarehouseInspectionRepository;
import com.drb.server.rest.dto.DashboardDto;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@ApplicationScoped
public class ReportsService {

    @PersistenceContext
    private EntityManager em;

    @Inject
    private ReturnRequestRepository returnRepo;

    @Inject
    private WarehouseInspectionRepository inspectionRepo;

    public DashboardDto getDashboard() {
        DashboardDto dto = new DashboardDto();
        dto.statusCounts = new LinkedHashMap<>();
        List<ReturnRequest> all = returnRepo.findAll();
        for (ReturnStatus s : ReturnStatus.values()) {
            dto.statusCounts.put(s.name(), all.stream().filter(r -> r.getStatus() == s).count());
        }
        dto.noBarcode      = returnRepo.countByBarcodeIsNull();
        dto.totalOpen      = dto.statusCounts.getOrDefault(ReturnStatus.OPEN.name(), 0L);
        dto.totalPickedUp  = dto.statusCounts.getOrDefault(ReturnStatus.PICKED_UP.name(), 0L);
        dto.totalInspected = dto.statusCounts.getOrDefault(ReturnStatus.INSPECTED.name(), 0L);
        dto.totalClosed    = dto.statusCounts.getOrDefault(ReturnStatus.CLOSED.name(), 0L);
        return dto;
    }

    public Map<String, Long> getTopReturnReasons() {
        return returnRepo.findAll().stream()
            .filter(r -> r.getReason() != null && !r.getReason().isBlank())
            .collect(Collectors.groupingBy(ReturnRequest::getReason, Collectors.counting()));
    }

    public List<Map<String, Object>> getReturnsByDriver() {
        List<Object[]> rows = em.createQuery(
                "SELECT u.fullName, COUNT(r) FROM ReturnRequest r " +
                "JOIN r.driver d JOIN d.user u GROUP BY u.fullName ORDER BY COUNT(r) DESC",
                Object[].class).getResultList();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("driver", row[0]);
            entry.put("count", row[1]);
            result.add(entry);
        }
        return result;
    }

    public List<Map<String, Object>> getReturnsByCustomer() {
        List<Object[]> rows = em.createQuery(
                "SELECT c.fullName, COUNT(r) FROM ReturnRequest r " +
                "JOIN r.customer c GROUP BY c.fullName ORDER BY COUNT(r) DESC",
                Object[].class).getResultList();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("customer", row[0]);
            entry.put("count", row[1]);
            result.add(entry);
        }
        return result;
    }

    public List<Map<String, Object>> getMonthlyVolume() {
        List<ReturnRequest> all = returnRepo.findAll();
        Map<String, Long> byMonth = new TreeMap<>();
        for (ReturnRequest rr : all) {
            if (rr.getCreatedAt() != null) {
                String month = rr.getCreatedAt().getYear() + "-"
                    + String.format("%02d", rr.getCreatedAt().getMonthValue());
                byMonth.merge(month, 1L, Long::sum);
            }
        }
        return byMonth.entrySet().stream()
            .map(e -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("month", e.getKey());
                row.put("count", e.getValue());
                return row;
            })
            .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getReturnsByStatus() {
        List<ReturnRequest> all = returnRepo.findAll();
        Map<ReturnStatus, Long> counts = all.stream()
            .collect(Collectors.groupingBy(ReturnRequest::getStatus, Collectors.counting()));
        return counts.entrySet().stream()
            .map(e -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("status", e.getKey().name());
                row.put("count", e.getValue());
                return row;
            })
            .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getWarehouseDecisions() {
        List<WarehouseInspection> all = inspectionRepo.findAll();
        Map<String, Long> counts = new LinkedHashMap<>();
        for (WarehouseDecision d : WarehouseDecision.values()) counts.put(d.name(), 0L);
        all.stream()
            .filter(i -> i.getWarehouseDecision() != null)
            .forEach(i -> counts.merge(i.getWarehouseDecision().name(), 1L, Long::sum));
        return counts.entrySet().stream()
            .map(e -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("decision", e.getKey());
                row.put("count", e.getValue());
                return row;
            })
            .collect(Collectors.toList());
    }

    public List<ReturnRequest> getMissingInfo() {
        return returnRepo.findByStatus(ReturnStatus.NEEDS_MORE_INFO);
    }

    public List<Map<String, Object>> getDriverPerformance() {
        return getReturnsByDriver();
    }

    public List<Map<String, Object>> getDailyReturns() {
        List<ReturnRequest> all = returnRepo.findAll();
        Map<LocalDate, Long> byDay = new TreeMap<>();
        for (ReturnRequest rr : all) {
            if (rr.getCreatedAt() != null) {
                LocalDate day = rr.getCreatedAt().toLocalDate();
                byDay.merge(day, 1L, Long::sum);
            }
        }
        return byDay.entrySet().stream()
            .map(e -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("date", e.getKey().toString());
                row.put("count", e.getValue());
                return row;
            })
            .collect(Collectors.toList());
    }
}
