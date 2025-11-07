package com.lemondelila.client.model.catalogue;

import java.util.List;
import java.util.Objects;

public record CatalogCategory(String id,
                              String name,
                              List<CatalogCategory> children) {

    public CatalogCategory {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(children, "children");
        children = List.copyOf(children);
    }

    public List<CatalogCategory> children() {
        return children;
    }

    public void visit(java.util.function.Consumer<CatalogCategory> consumer) {
        consumer.accept(this);
        for (CatalogCategory child : children) {
            child.visit(consumer);
        }
    }
}

