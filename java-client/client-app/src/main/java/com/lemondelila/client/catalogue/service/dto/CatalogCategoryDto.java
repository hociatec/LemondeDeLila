package com.lemondelila.client.catalogue.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class CatalogCategoryDto {

    private String id;
    private String name;
    private List<CatalogCategoryDto> children;

    public String id() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String name() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public List<CatalogCategoryDto> children() {
        return children;
    }

    public void setChildren(List<CatalogCategoryDto> children) {
        this.children = children;
    }
}
