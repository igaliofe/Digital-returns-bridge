package com.drb.server.web;

import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.service.ReturnRequestService;
import jakarta.annotation.PostConstruct;
import jakarta.faces.view.ViewScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import java.io.Serializable;
import java.util.List;
import java.util.stream.Collectors;

@Named
@ViewScoped
public class ReturnListBean implements Serializable {

    @Inject
    private ReturnRequestService returnService;

    private List<ReturnRequest> returns;
    private String filterStatus;
    private boolean filterHasNoBarcode;

    @PostConstruct
    public void init() {
        load();
    }

    public void load() {
        if (filterStatus != null && !filterStatus.isBlank()) {
            returns = returnService.findByStatus(ReturnStatus.valueOf(filterStatus));
        } else {
            returns = returnService.findAll();
        }
        if (filterHasNoBarcode) {
            returns = returns.stream()
                .filter(r -> r.getBarcode() == null)
                .collect(Collectors.toList());
        }
    }

    public List<ReturnRequest> getReturns() { return returns; }

    public String getFilterStatus() { return filterStatus; }
    public void setFilterStatus(String s) { this.filterStatus = s; }

    public boolean isFilterHasNoBarcode() { return filterHasNoBarcode; }
    public void setFilterHasNoBarcode(boolean b) { this.filterHasNoBarcode = b; }

    public ReturnStatus[] getStatuses() { return ReturnStatus.values(); }
}
