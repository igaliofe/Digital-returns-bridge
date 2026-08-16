package com.drb.server.web;

import com.drb.server.domain.ReturnImage;
import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.StatusHistory;
import com.drb.server.repository.StatusHistoryRepository;
import com.drb.server.service.ImageService;
import com.drb.server.service.ReturnRequestService;
import jakarta.annotation.PostConstruct;
import jakarta.faces.context.FacesContext;
import jakarta.faces.view.ViewScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import java.io.Serializable;
import java.util.List;
import java.util.Map;

@Named
@ViewScoped
public class ReturnDetailsBean implements Serializable {

    @Inject private ReturnRequestService returnService;
    @Inject private ImageService imageService;
    @Inject private StatusHistoryRepository statusHistoryRepo;

    private Long id;
    private ReturnRequest returnRequest;
    private List<ReturnImage> images;
    private List<StatusHistory> statusHistory;

    @PostConstruct
    public void init() {
        Map<String, String> params = FacesContext.getCurrentInstance()
            .getExternalContext().getRequestParameterMap();
        String idParam = params.get("id");
        // A non-numeric id must not blow up the page: leave everything null so the view renders
        // its "Return request not found." branch instead of propagating a NumberFormatException.
        Long parsedId = parseId(idParam);
        if (parsedId != null) {
            id = parsedId;
            returnRequest = returnService.getById(id);
            images = imageService.findByReturnRequestId(id);
            statusHistory = statusHistoryRepo.findByReturnRequestIdWithUser(id);
        }
    }

    private static Long parseId(String idParam) {
        if (idParam == null || idParam.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(idParam);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public Long getId() { return id; }
    public ReturnRequest getReturnRequest() { return returnRequest; }
    public List<ReturnImage> getImages() { return images; }
    public List<StatusHistory> getStatusHistory() { return statusHistory; }
    public boolean isBarcodeAssigned() { return returnRequest != null && returnRequest.getBarcode() != null; }
}
