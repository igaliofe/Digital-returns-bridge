package com.drb.server.service;

import com.drb.server.domain.User;
import com.drb.server.domain.WarehouseInspection;
import com.drb.server.domain.enums.ItemCondition;
import com.drb.server.domain.enums.WarehouseDecision;
import com.drb.server.repository.WarehouseInspectionRepository;
import com.drb.server.rest.dto.WarehouseInspectionRequest;
import com.drb.server.service.exception.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class WarehouseInspectionService {

    @Inject
    private WarehouseInspectionRepository inspectionRepo;

    @Transactional
    public WarehouseInspection update(Long inspectionId, WarehouseInspectionRequest req, User user) {
        WarehouseInspection existing = inspectionRepo.findById(inspectionId);
        if (existing == null) throw new NotFoundException("WarehouseInspection", inspectionId);
        if (req.warehouseDecision != null && !req.warehouseDecision.isBlank()) {
            existing.setWarehouseDecision(
                EnumParser.parse(WarehouseDecision.class, req.warehouseDecision, "warehouseDecision"));
        }
        if (req.itemCondition != null && !req.itemCondition.isBlank()) {
            existing.setItemCondition(EnumParser.parse(ItemCondition.class, req.itemCondition, "itemCondition"));
        }
        if (req.callFullyHandled != null) {
            existing.setCallFullyHandled(req.callFullyHandled);
        }
        if (req.warehouseNotes != null) {
            existing.setWarehouseNotes(req.warehouseNotes);
        }
        if (user != null) {
            existing.setInspectedByUser(user);
        }
        return inspectionRepo.update(existing);
    }
}
