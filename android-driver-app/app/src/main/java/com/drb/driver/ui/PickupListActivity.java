package com.drb.driver.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
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
import java.util.List;

public class PickupListActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView tvEmpty;
    private SessionManager sessionManager;
    private PickupAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pickup_list);

        sessionManager = new SessionManager(this);

        recyclerView = findViewById(R.id.recyclerPickups);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        progressBar = findViewById(R.id.progressBar);
        tvEmpty = findViewById(R.id.tvEmpty);

        adapter = new PickupAdapter(new ArrayList<>());
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);

        swipeRefresh.setOnRefreshListener(this::loadPickups);

        loadPickups();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadPickups();
    }

    private void loadPickups() {
        Long driverId = sessionManager.getDriverId();
        if (driverId == -1L) {
            fetchMeAndLoad();
            return;
        }
        fetchPickups(driverId);
    }

    private void fetchMeAndLoad() {
        progressBar.setVisibility(View.VISIBLE);
        ApiClient.get(sessionManager).me().enqueue(new Callback<com.drb.driver.model.UserModel>() {
            @Override
            public void onResponse(Call<com.drb.driver.model.UserModel> call, Response<com.drb.driver.model.UserModel> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Long id = response.body().id;
                    sessionManager.setDriverId(id);
                    fetchPickups(id);
                } else {
                    progressBar.setVisibility(View.GONE);
                    swipeRefresh.setRefreshing(false);
                    Toast.makeText(PickupListActivity.this, "Failed to load driver info", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<com.drb.driver.model.UserModel> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                Toast.makeText(PickupListActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void fetchPickups(Long driverId) {
        progressBar.setVisibility(View.VISIBLE);
        ApiClient.get(sessionManager).myPickups(driverId).enqueue(new Callback<List<ReturnRequestModel>>() {
            @Override
            public void onResponse(Call<List<ReturnRequestModel>> call, Response<List<ReturnRequestModel>> response) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null) {
                    List<ReturnRequestModel> pickups = response.body();
                    adapter.setData(pickups);
                    tvEmpty.setVisibility(pickups.isEmpty() ? View.VISIBLE : View.GONE);
                } else {
                    Toast.makeText(PickupListActivity.this, "Failed to load pickups", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<List<ReturnRequestModel>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                Toast.makeText(PickupListActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, Menu.FIRST, 0, "Logout");
        return true;
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
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }

    // ──────────────────────────── Adapter ────────────────────────────

    private class PickupAdapter extends RecyclerView.Adapter<PickupAdapter.ViewHolder> {
        private List<ReturnRequestModel> items;

        PickupAdapter(List<ReturnRequestModel> items) {
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
            holder.tvCustomerName.setText(item.customerName != null ? item.customerName : "—");
            holder.tvAddress.setText(item.orderNumber != null ? "Order: " + item.orderNumber : "");
            holder.tvProduct.setText(item.productName != null ? item.productName : "");
            String barcodeLabel = item.isBarcodeAssigned() ? "Barcode: " + item.barcode : "Barcode: Not assigned";
            holder.tvStatus.setText(item.status + " · " + barcodeLabel);
            holder.itemView.setOnClickListener(v -> {
                Intent intent = new Intent(PickupListActivity.this, PickupDetailsActivity.class);
                intent.putExtra(PickupDetailsActivity.EXTRA_RETURN_ID, item.id);
                startActivity(intent);
            });
        }

        @Override
        public int getItemCount() {
            return items.size();
        }

        class ViewHolder extends RecyclerView.ViewHolder {
            TextView tvCustomerName, tvAddress, tvProduct, tvStatus;

            ViewHolder(View v) {
                super(v);
                tvCustomerName = v.findViewById(R.id.tvCustomerName);
                tvAddress = v.findViewById(R.id.tvAddress);
                tvProduct = v.findViewById(R.id.tvProduct);
                tvStatus = v.findViewById(R.id.tvStatus);
            }
        }
    }
}
