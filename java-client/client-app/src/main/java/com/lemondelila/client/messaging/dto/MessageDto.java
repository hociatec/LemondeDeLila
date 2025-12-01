package com.lemondelila.client.messaging.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class MessageDto {

    private String id;
    private MessageUserDto sender;
    private MessageUserDto recipient;
    private String text;
    private String createdAt;
    private String direction;
    private String deletedAt;

    public String id() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public MessageUserDto sender() {
        return sender;
    }

    public void setSender(MessageUserDto sender) {
        this.sender = sender;
    }

    public MessageUserDto recipient() {
        return recipient;
    }

    public void setRecipient(MessageUserDto recipient) {
        this.recipient = recipient;
    }

    public String text() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String createdAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String direction() {
        return direction;
    }

    public void setDirection(String direction) {
        this.direction = direction;
    }

    public String deletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(String deletedAt) {
        this.deletedAt = deletedAt;
    }
}
