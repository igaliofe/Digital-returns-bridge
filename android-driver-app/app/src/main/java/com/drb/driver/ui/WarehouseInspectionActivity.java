package com.drb.driver.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import com.bumptech.glide.Glide;
import com.drb.driver.R;
import com.drb.driver.api.ApiClient;
import com.drb.driver.api.ApiErrors;
import com.drb.driver.model.PickupUpdateModel;
import com.drb.driver.model.ReturnImageModel;
import com.drb.driver.model.ReturnRequestModel;
import com.drb.driver.model.StatusUpdateRequest;
import com.drb.driver.model.WarehouseInspectionModel;
import com.drb.driver.model.WarehouseInspectionRequest;
import com.drb.driver.session.SessionManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.util.List;
import java.util.Locale;

public class WarehouseInspectionActivity extends AppCompatActivity {

    public static final String EXTRA_RETURN_ID = "return_id";

    private static final String STATUS_NEEDS_MORE_INFO = "NEEDS_MORE_INFO";
    private static final String STATUS_CLOSED = "CLOSED";

    private static final String DRIVER_DEFECT_IMAGE = "DRIVER_DEFECT_IMAGE";

    // Inspection enum value strings (sent to the server exactly as-is).
    private static final String[] ITEM_CONDITIONS = {
        "LIKE_NEW_ORIGINAL_PACKAGING",
        "LIKE_NEW_NO_PACKAGING",
        "USED",
        "USED_MINOR_DEFECT",
        "SIGNIFICANTLY_DEFECTIVE"
    };

    // Classification decisions plus frozen further-handling options.
    private static final String[] WAREHOUSE_DECISIONS = {
        "STOCK_AS_NEW_114",
        "CLASS_B",
        "SHAPIIM_155",
        "REDESIGN_208",
        "FROZEN_FURTHER_HANDLING",
        "REPAIR",
        "DISPOSE"
    };

    private ImageView ivCatalog;
    private TextView tvOriginalDelivery, tvReturnDate, tvSku, tvItem, tvPrice, tvReturnReason, tvStatus;
    private TextView lblServiceImages, tvServiceDefect, tvDriverDefect, tvDriverNotes, lblDriverImages;
    private LinearLayout containerServiceImages, containerDriverImages;
    private View cardDefect;
    private Spinner spinnerCondition, spinnerDecision;
    private CheckBox cbFullyHandled;
    private EditText etNotes;
    private Button btnRequestMoreInfo, btnSubmit;

    private SessionManager sessionManager;
    private Long returnId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_warehouse_inspection);
        HeaderHelper.setupSubScreen(this, R.string.wh_inspection_short_title);

        sessionManager = new SessionManager(this);
        returnId = getIntent().getLongExtra(EXTRA_RETURN_ID, -1L);

        ivCatalog = findViewById(R.id.ivCatalog);
        tvOriginalDelivery = findViewById(R.id.tvOriginalDelivery);
        tvReturnDate = findViewById(R.id.tvReturnDate);
        tvSku = findViewById(R.id.tvSku);
        tvItem = findViewById(R.id.tvItem);
        tvPrice = findViewById(R.id.tvPrice);
        tvReturnReason = findViewById(R.id.tvReturnReason);
        tvStatus = findViewById(R.id.tvStatus);
        lblServiceImages = findViewById(R.id.lblServiceImages);
        containerServiceImages = findViewById(R.id.containerServiceImages);
        cardDefect = findViewById(R.id.cardDefect);
        tvServiceDefect = findViewById(R.id.tvServiceDefect);
        tvDriverDefect = findViewById(R.id.tvDriverDefect);
        tvDriverNotes = findViewById(R.id.tvDriverNotes);
        lblDriverImages = findViewById(R.id.lblDriverImages);
        containerDriverImages = findViewById(R.id.containerDriverImages);
        spinnerCondition = findViewById(R.id.spinnerCondition);
        spinnerDecision = findViewById(R.id.spinnerDecision);
        cbFullyHandled = findViewById(R.id.cbFullyHandled);
        etNotes = findViewById(R.id.etNotes);
        btnRequestMoreInfo = findViewById(R.id.btnRequestMoreInfo);
        btnSubmit = findViewById(R.id.btnSubmit);

        spinnerCondition.setAdapter(buildAdapter(ITEM_CONDITIONS));
        spinnerDecision.setAdapter(buildAdapter(WAREHOUSE_DECISIONS));

        btnRequestMoreInfo.setOnClickListener(v -> promptRequestMoreInfo());
        btnSubmit.setOnClickListener(v -> submitInspection());

        loadReturn();
        loadImages();
        loadPickupUpdates();
    }

    private ArrayAdapter<String> buildAdapter(String[] values) {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_item, values);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        return adapter;
    }

    // ──────────────────────────── Loading ────────────────────────────

    private void loadReturn() {
        ApiClient.get(sessionManager).returnDetails(returnId).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                if (response.isSuccessful() && response.body() != null) {
                    bindReturn(response.body());
                } else {
                    Toast.makeText(WarehouseInspectionActivity.this, "Failed to load return", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                Toast.makeText(WarehouseInspectionActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void bindReturn(ReturnRequestModel r) {
        setRow(tvOriginalDelivery, "Original delivery", r.originalDeliveryDate);
        setRow(tvReturnDate, "Return date", r.createdAt);
        setRow(tvSku, "SKU", r.productSku);
        setRow(tvItem, "Item", r.productName != null ? r.productName : r.productDescription);
        tvPrice.setText("Price: " + (r.productPrice != null ? String.format(Locale.US, "%.2f", r.productPrice) : "—"));
        setRow(tvReturnReason, "Return reason", r.returnReason != null ? r.returnReason : r.reason);
        tvStatus.setText("Status: " + safe(r.status));

        if (r.productImageUrl != null && !r.productImageUrl.isEmpty()) {
            ivCatalog.setVisibility(View.VISIBLE);
            Glide.with(this).load(r.productImageUrl).into(ivCatalog);
        } else {
            ivCatalog.setVisibility(View.GONE);
        }

        // Service-side defect details, if any.
        StringBuilder svc = new StringBuilder();
        appendIf(svc, "Defect type", r.defectType);
        appendIf(svc, "Defect stage", r.defectStage);
        appendIf(svc, "Defect location", r.defectLocationText);
        appendIf(svc, "Defect description", r.defectDescription);
        if (svc.length() > 0) {
            cardDefect.setVisibility(View.VISIBLE);
            tvServiceDefect.setText("Service assessment:\n" + svc.toString().trim());
            tvServiceDefect.setVisibility(View.VISIBLE);
        } else {
            tvServiceDefect.setVisibility(View.GONE);
        }
    }

    private void loadImages() {
        ApiClient.get(sessionManager).getImages(returnId).enqueue(new Callback<List<ReturnImageModel>>() {
            @Override
            public void onResponse(Call<List<ReturnImageModel>> call, Response<List<ReturnImageModel>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    bindImages(response.body());
                }
            }

            @Override
            public void onFailure(Call<List<ReturnImageModel>> call, Throwable t) {
                // Images are supplementary; ignore failures silently.
            }
        });
    }

    private void bindImages(List<ReturnImageModel> images) {
        for (ReturnImageModel img : images) {
            if (img == null || img.imageUrl == null) continue;
            String type = img.imageType != null ? img.imageType : "";
            if (type.startsWith("SERVICE_")) {
                addThumbnail(containerServiceImages, img.imageUrl);
                lblServiceImages.setVisibility(View.VISIBLE);
            } else if (DRIVER_DEFECT_IMAGE.equals(type)) {
                addThumbnail(containerDriverImages, img.imageUrl);
                lblDriverImages.setVisibility(View.VISIBLE);
                cardDefect.setVisibility(View.VISIBLE);
            }
        }
    }

    private void addThumbnail(LinearLayout container, String url) {
        ImageView iv = new ImageView(this);
        int size = (int) (96 * getResources().getDisplayMetrics().density);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(size, size);
        lp.rightMargin = (int) (8 * getResources().getDisplayMetrics().density);
        iv.setLayoutParams(lp);
        iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
        iv.setBackgroundColor(0xFFF0F0F0);
        container.addView(iv);
        Glide.with(this).load(url).into(iv);
    }

    private void loadPickupUpdates() {
        ApiClient.get(sessionManager).getPickupUpdates(returnId).enqueue(new Callback<List<PickupUpdateModel>>() {
            @Override
            public void onResponse(Call<List<PickupUpdateModel>> call, Response<List<PickupUpdateModel>> response) {
                if (response.isSuccessful() && response.body() != null && !response.body().isEmpty()) {
                    bindPickupUpdate(response.body().get(response.body().size() - 1));
                }
            }

            @Override
            public void onFailure(Call<List<PickupUpdateModel>> call, Throwable t) {
                // Supplementary; ignore failures silently.
            }
        });
    }

    private void bindPickupUpdate(PickupUpdateModel u) {
        StringBuilder sb = new StringBuilder();
        appendIf(sb, "Defect type", u.defectType);
        appendIf(sb, "Defect location", u.defectLocation);
        appendIf(sb, "Defect location (other)", u.defectLocationOther);
        if (sb.length() > 0) {
            cardDefect.setVisibility(View.VISIBLE);
            tvDriverDefect.setText("Driver assessment:\n" + sb.toString().trim());
            tvDriverDefect.setVisibility(View.VISIBLE);
        } else {
            tvDriverDefect.setVisibility(View.GONE);
        }
        if (u.driverNotes != null && !u.driverNotes.trim().isEmpty()) {
            cardDefect.setVisibility(View.VISIBLE);
            tvDriverNotes.setText("Driver notes: " + u.driverNotes.trim());
            tvDriverNotes.setVisibility(View.VISIBLE);
        } else {
            tvDriverNotes.setVisibility(View.GONE);
        }
    }

    // ──────────────────────────── Actions ────────────────────────────

    private void promptRequestMoreInfo() {
        final EditText input = new EditText(this);
        input.setHint(getString(R.string.wh_more_info_comment_hint));
        new AlertDialog.Builder(this)
            .setTitle(R.string.wh_request_more_info)
            .setView(input)
            .setPositiveButton(R.string.wh_send, (dialog, which) -> {
                String comment = input.getText() != null ? input.getText().toString().trim() : "";
                requestMoreInfo(comment.isEmpty() ? null : comment);
            })
            .setNegativeButton(android.R.string.cancel, null)
            .show();
    }

    private void requestMoreInfo(String comment) {
        btnRequestMoreInfo.setEnabled(false);
        StatusUpdateRequest req = new StatusUpdateRequest(STATUS_NEEDS_MORE_INFO, comment);
        ApiClient.get(sessionManager).updateStatus(returnId, req).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                btnRequestMoreInfo.setEnabled(true);
                if (response.isSuccessful()) {
                    Toast.makeText(WarehouseInspectionActivity.this, "Requested more info", Toast.LENGTH_SHORT).show();
                    finish();
                } else if (ApiErrors.isConcurrentModification(response)) {
                    Toast.makeText(WarehouseInspectionActivity.this,
                        ApiErrors.CONCURRENT_MODIFICATION_MESSAGE, Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(WarehouseInspectionActivity.this, "Failed (" + response.code() + ")", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                btnRequestMoreInfo.setEnabled(true);
                Toast.makeText(WarehouseInspectionActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void submitInspection() {
        WarehouseInspectionRequest req = new WarehouseInspectionRequest();
        req.itemCondition = (String) spinnerCondition.getSelectedItem();
        req.warehouseDecision = (String) spinnerDecision.getSelectedItem();
        req.callFullyHandled = cbFullyHandled.isChecked();
        String notes = etNotes.getText() != null ? etNotes.getText().toString().trim() : "";
        req.warehouseNotes = notes.isEmpty() ? null : notes;

        final boolean fullyHandled = cbFullyHandled.isChecked();

        btnSubmit.setEnabled(false);
        ApiClient.get(sessionManager).createWarehouseInspection(returnId, req).enqueue(new Callback<WarehouseInspectionModel>() {
            @Override
            public void onResponse(Call<WarehouseInspectionModel> call, Response<WarehouseInspectionModel> response) {
                if (response.isSuccessful()) {
                    if (fullyHandled) {
                        closeRequest();
                    } else {
                        btnSubmit.setEnabled(true);
                        Toast.makeText(WarehouseInspectionActivity.this, "Inspection saved", Toast.LENGTH_SHORT).show();
                        finish();
                    }
                } else if (ApiErrors.isConcurrentModification(response)) {
                    btnSubmit.setEnabled(true);
                    Toast.makeText(WarehouseInspectionActivity.this,
                        ApiErrors.CONCURRENT_MODIFICATION_MESSAGE, Toast.LENGTH_LONG).show();
                } else {
                    btnSubmit.setEnabled(true);
                    Toast.makeText(WarehouseInspectionActivity.this, "Submit failed (" + response.code() + ")", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<WarehouseInspectionModel> call, Throwable t) {
                btnSubmit.setEnabled(true);
                Toast.makeText(WarehouseInspectionActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void closeRequest() {
        StatusUpdateRequest req = new StatusUpdateRequest(STATUS_CLOSED, null);
        ApiClient.get(sessionManager).updateStatus(returnId, req).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                btnSubmit.setEnabled(true);
                if (response.isSuccessful()) {
                    Toast.makeText(WarehouseInspectionActivity.this, "Inspection saved and request closed", Toast.LENGTH_SHORT).show();
                } else if (ApiErrors.isConcurrentModification(response)) {
                    Toast.makeText(WarehouseInspectionActivity.this,
                        "Inspection saved. " + ApiErrors.CONCURRENT_MODIFICATION_MESSAGE, Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(WarehouseInspectionActivity.this, "Inspection saved, but closing failed (" + response.code() + ")", Toast.LENGTH_LONG).show();
                }
                finish();
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                btnSubmit.setEnabled(true);
                Toast.makeText(WarehouseInspectionActivity.this, "Inspection saved, but closing failed: " + t.getMessage(), Toast.LENGTH_LONG).show();
                finish();
            }
        });
    }

    // ──────────────────────────── Helpers ────────────────────────────

    private void setRow(TextView tv, String label, String value) {
        if (value != null && !value.trim().isEmpty()) {
            tv.setVisibility(View.VISIBLE);
            tv.setText(label + ": " + value);
        } else {
            tv.setVisibility(View.GONE);
        }
    }

    private void appendIf(StringBuilder sb, String label, String value) {
        if (value != null && !value.trim().isEmpty()) {
            if (sb.length() > 0) sb.append("\n");
            sb.append(label).append(": ").append(value.trim());
        }
    }

    private String safe(String s) {
        return s != null ? s : "—";
    }
}
