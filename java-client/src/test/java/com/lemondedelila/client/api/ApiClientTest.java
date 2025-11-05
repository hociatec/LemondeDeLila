package com.lemondedelila.client.api;

import org.junit.Assert;
import org.junit.Test;

public class ApiClientTest {
    @Test
    public void testConstruct() {
        ApiClient c = new ApiClient("http://localhost:8000");
        Assert.assertNotNull(c);
    }
}
