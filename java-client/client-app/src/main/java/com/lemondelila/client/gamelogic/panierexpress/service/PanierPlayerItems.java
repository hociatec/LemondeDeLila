package com.lemondelila.client.gamelogic.panierexpress.service;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Snapshot léger des items du joueur à afficher.
 */
public final class PanierPlayerItems {
    private final String username;
    private final List<String> basket;
    private final List<String> inventory;
    private final List<String> shoppingList;

    public PanierPlayerItems(String username,
                             List<String> basket,
                             List<String> inventory,
                             List<String> shoppingList) {
        this.username = username == null ? "Vous" : username;
        this.basket = basket == null ? List.of() : List.copyOf(basket);
        this.inventory = inventory == null ? List.of() : List.copyOf(inventory);
        this.shoppingList = shoppingList == null ? List.of() : List.copyOf(shoppingList);
    }

    public String username() {
        return username;
    }

    public List<String> basket() {
        return Collections.unmodifiableList(basket);
    }

    public List<String> inventory() {
        return Collections.unmodifiableList(inventory);
    }

    public List<String> shoppingList() {
        return Collections.unmodifiableList(shoppingList);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PanierPlayerItems that)) return false;
        return Objects.equals(username, that.username)
                && Objects.equals(basket, that.basket)
                && Objects.equals(inventory, that.inventory)
                && Objects.equals(shoppingList, that.shoppingList);
    }

    @Override
    public int hashCode() {
        return Objects.hash(username, basket, inventory, shoppingList);
    }

    @Override
    public String toString() {
        return "PanierPlayerItems{" +
                "username='" + username + '\'' +
                ", basket=" + basket +
                ", inventory=" + inventory +
                ", shoppingList=" + shoppingList +
                '}';
    }
}
