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

        View header = findViewById(R.id.pickupHeader);
        if (header != null) {
            TextView tvTitle = header.findViewById(R.id.tvHeaderTitle);
            if (tvTitle != null) {
                tvTitle.setText(R.string.my_pickups_title);
            }
            TextView tvLogout = header.findViewById(R.id.tvHeaderAction);
            if (tvLogout != null) {
                tvLogout.setVisibility(View.VISIBLE);
                tvLogout.setOnClickListener(v -> performLogout());
            }
        }

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
        DriverIdResolver.resolve(this, sessionManager, new DriverIdResolver.DriverIdCallback() {
            @Override
            public void onResolved(Long driverId) {
                fetchPickups(driverId);
            }

            @Override
            public void onFailure(String message) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                DriverIdResolver.toastFailure(PickupListActivity.this, message);
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
        startActivity(logoutIntent(this));
        finish();
    }

    static Intent logoutIntent(android.content.Context context) {
        Intent intent = new Intent(context, LoginActivity.class);
        intent.putExtra(LoginActivity.EXTRA_PREFERRED_ROLE, NavigationHelper.ROLE_DRIVER);
        return intent;
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
            ReturnCardBinder.bind(holder.itemView, item, false);
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
            ViewHolder(View v) {
                super(v);
            }
        }
    }
}
