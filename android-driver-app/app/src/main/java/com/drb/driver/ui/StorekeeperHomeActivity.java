package com.drb.driver.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.drb.driver.R;
import com.drb.driver.api.ApiClient;
import com.drb.driver.model.ReturnRequestModel;
import com.drb.driver.session.SessionManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class StorekeeperHomeActivity extends AppCompatActivity {

    // Work-queue statuses, fetched separately and merged client-side.
    private static final String STATUS_PICKED_UP = "PICKED_UP";
    private static final String STATUS_ARRIVED = "ARRIVED_TO_WAREHOUSE";

    private RecyclerView recyclerView;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView tvEmpty;
    private Button btnScanLookup;
    private SessionManager sessionManager;
    private QueueAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_storekeeper_home);

        sessionManager = new SessionManager(this);

        View header = findViewById(R.id.storekeeperHeader);
        if (header != null) {
            TextView tvTitle = header.findViewById(R.id.tvHeaderTitle);
            if (tvTitle != null) {
                tvTitle.setText(R.string.wh_receiving_title);
            }
            TextView tvLogout = header.findViewById(R.id.tvHeaderAction);
            if (tvLogout != null) {
                tvLogout.setVisibility(View.VISIBLE);
                tvLogout.setOnClickListener(v -> performLogout());
            }
        }

        recyclerView = findViewById(R.id.recyclerQueue);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        progressBar = findViewById(R.id.progressBar);
        tvEmpty = findViewById(R.id.tvEmpty);
        btnScanLookup = findViewById(R.id.btnScanLookup);

        adapter = new QueueAdapter(new ArrayList<>());
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);

        swipeRefresh.setOnRefreshListener(this::loadQueue);
        btnScanLookup.setOnClickListener(v ->
            startActivity(new Intent(this, WarehouseScanActivity.class)));

        loadQueue();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadQueue();
    }

    private void loadQueue() {
        progressBar.setVisibility(View.VISIBLE);
        // Two single-status calls merged client-side (server takes ONE status per call).
        ApiClient.get(sessionManager).getReturnsByStatus(STATUS_PICKED_UP).enqueue(new Callback<List<ReturnRequestModel>>() {
            @Override
            public void onResponse(Call<List<ReturnRequestModel>> call, Response<List<ReturnRequestModel>> response) {
                List<ReturnRequestModel> pickedUp = response.isSuccessful() && response.body() != null
                    ? response.body() : new ArrayList<>();
                fetchArrivedAndMerge(pickedUp);
            }

            @Override
            public void onFailure(Call<List<ReturnRequestModel>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                Toast.makeText(StorekeeperHomeActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void fetchArrivedAndMerge(List<ReturnRequestModel> pickedUp) {
        ApiClient.get(sessionManager).getReturnsByStatus(STATUS_ARRIVED).enqueue(new Callback<List<ReturnRequestModel>>() {
            @Override
            public void onResponse(Call<List<ReturnRequestModel>> call, Response<List<ReturnRequestModel>> response) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                List<ReturnRequestModel> arrived = response.isSuccessful() && response.body() != null
                    ? response.body() : new ArrayList<>();
                List<ReturnRequestModel> merged = merge(pickedUp, arrived);
                adapter.setData(merged);
                tvEmpty.setVisibility(merged.isEmpty() ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onFailure(Call<List<ReturnRequestModel>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                // Still show whatever the first call returned.
                adapter.setData(pickedUp);
                tvEmpty.setVisibility(pickedUp.isEmpty() ? View.VISIBLE : View.GONE);
                Toast.makeText(StorekeeperHomeActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private List<ReturnRequestModel> merge(List<ReturnRequestModel> a, List<ReturnRequestModel> b) {
        Map<Long, ReturnRequestModel> byId = new LinkedHashMap<>();
        for (ReturnRequestModel r : a) {
            if (r != null && r.id != null) byId.put(r.id, r);
        }
        for (ReturnRequestModel r : b) {
            if (r != null && r.id != null) byId.put(r.id, r);
        }
        return new ArrayList<>(byId.values());
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        return false;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == Menu.FIRST) {
            performLogout();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void performLogout() {
        ApiClient.get(sessionManager).logout().enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> response) {
                // ignore server response, clear locally
            }

            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                // clear locally regardless
            }
        });
        sessionManager.clearSession();
        ApiClient.reset();
        Intent intent = new Intent(this, LoginActivity.class);
        intent.putExtra(LoginActivity.EXTRA_PREFERRED_ROLE, NavigationHelper.ROLE_WAREHOUSE);
        startActivity(intent);
        finish();
    }

    // ──────────────────────────── Adapter ────────────────────────────

    private class QueueAdapter extends RecyclerView.Adapter<QueueAdapter.ViewHolder> {
        private List<ReturnRequestModel> items;

        QueueAdapter(List<ReturnRequestModel> items) {
            this.items = items;
        }

        void setData(List<ReturnRequestModel> data) {
            this.items = data;
            notifyDataSetChanged();
        }

        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = getLayoutInflater().inflate(R.layout.item_pickup, parent, false);
            return new ViewHolder(v);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            ReturnRequestModel item = items.get(position);
            ReturnCardBinder.bind(holder.itemView, item, true);
            holder.itemView.setOnClickListener(v -> {
                Intent intent = new Intent(StorekeeperHomeActivity.this, WarehouseReturnDetailsActivity.class);
                intent.putExtra(WarehouseReturnDetailsActivity.EXTRA_BARCODE, item.barcode);
                intent.putExtra(WarehouseReturnDetailsActivity.EXTRA_RETURN_ID, item.id != null ? item.id : -1L);
                startActivity(intent);
            });
        }

        @Override
        public int getItemCount() {
            return items.size();
        }

        class ViewHolder extends RecyclerView.ViewHolder {
            ViewHolder(View v) {
                super(v);
            }
        }
    }
}
