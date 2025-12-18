/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.Authenticator;
import java.net.PasswordAuthentication;
import java.net.URL;
import java.nio.channels.Channels;
import java.nio.channels.ReadableByteChannel;
import java.util.Properties;

public class MavenWrapperDownloader {

    private static final String WRAPPER_VERSION = "3.3.2";
    private static final String DEFAULT_WRAPPER_URL =
            "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/" + WRAPPER_VERSION
                    + "/maven-wrapper-" + WRAPPER_VERSION + ".jar";

    public static void main(String[] args) {
        System.out.println("- Downloading Maven Wrapper...");

        File baseDirectory = new File(args.length > 0 ? args[0] : ".");
        File propertiesFile = new File(baseDirectory, ".mvn/wrapper/maven-wrapper.properties");
        File wrapperJar = new File(baseDirectory, ".mvn/wrapper/maven-wrapper.jar");

        Properties properties = new Properties();
        try (FileInputStream inputStream = new FileInputStream(propertiesFile)) {
            properties.load(inputStream);
        } catch (IOException e) {
            throw new RuntimeException("Could not load maven-wrapper.properties", e);
        }

        String url = properties.getProperty("wrapperUrl", DEFAULT_WRAPPER_URL);

        String username = System.getenv("MVNW_USERNAME");
        String password = System.getenv("MVNW_PASSWORD");
        if (username != null && password != null) {
            Authenticator.setDefault(new Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(username, password.toCharArray());
                }
            });
        }

        System.out.println("- Downloading from: " + url);
        try {
            downloadFileFromURL(url, wrapperJar);
            System.out.println("Done.");
        } catch (IOException e) {
            throw new RuntimeException("Could not download maven-wrapper.jar from " + url, e);
        }
    }

    private static void downloadFileFromURL(String urlString, File destination) throws IOException {
        if (!destination.getParentFile().exists() && !destination.getParentFile().mkdirs()) {
            throw new IOException("Could not create directory " + destination.getParentFile());
        }

        URL website = new URL(urlString);
        try (ReadableByteChannel rbc = Channels.newChannel(website.openStream());
             FileOutputStream fos = new FileOutputStream(destination)) {
            fos.getChannel().transferFrom(rbc, 0, Long.MAX_VALUE);
        }
    }
}

