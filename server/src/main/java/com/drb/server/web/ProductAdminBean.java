package com.drb.server.web;

import com.drb.server.cloudinary.CloudinaryImageService;
import com.drb.server.cloudinary.UploadResult;
import com.drb.server.domain.Product;
import com.drb.server.domain.enums.ImageType;
import com.drb.server.service.ProductService;
import jakarta.annotation.PostConstruct;
import jakarta.faces.application.FacesMessage;
import jakarta.faces.context.FacesContext;
import jakarta.faces.view.ViewScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.servlet.http.Part;
import java.io.InputStream;
import java.io.Serializable;
import java.util.List;

@Named
@ViewScoped
public class ProductAdminBean implements Serializable {

    @Inject
    private ProductService productService;

    @Inject
    private CloudinaryImageService cloudinaryImageService;

    private List<Product> products;
    private Product selected;
    private Product newProduct;
    private boolean showCreateDialog;
    private Part uploadedImage;

    @PostConstruct
    public void init() {
        loadProducts();
        newProduct = new Product();
    }

    private void loadProducts() {
        products = productService.findAll();
    }

    public void prepareCreate() {
        newProduct = new Product();
        showCreateDialog = true;
    }

    public void saveNew() {
        try {
            applyUploadedImage(newProduct);
            productService.save(newProduct);
            loadProducts();
            showCreateDialog = false;
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Product created", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    private void applyUploadedImage(Product product) throws Exception {
        if (uploadedImage != null && uploadedImage.getSize() > 0) {
            try (InputStream is = uploadedImage.getInputStream()) {
                UploadResult result = cloudinaryImageService.upload(is, ImageType.WAREHOUSE_IMAGE, 0L);
                product.setImageUrl(result.getUrl());
            }
            uploadedImage = null;
        }
    }

    public void saveSelected() {
        try {
            productService.save(selected);
            loadProducts();
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Product updated", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public void deleteProduct(Long id) {
        try {
            productService.delete(id);
            loadProducts();
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Product deleted", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public List<Product> getProducts() { return products; }
    public Product getSelected() { return selected; }
    public void setSelected(Product selected) { this.selected = selected; }
    public Product getNewProduct() { return newProduct; }
    public boolean isShowCreateDialog() { return showCreateDialog; }
    public void setShowCreateDialog(boolean showCreateDialog) { this.showCreateDialog = showCreateDialog; }
    public Part getUploadedImage() { return uploadedImage; }
    public void setUploadedImage(Part uploadedImage) { this.uploadedImage = uploadedImage; }
}
