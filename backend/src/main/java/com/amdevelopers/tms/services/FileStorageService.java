package com.amdevelopers.tms.services;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * Persists uploaded image files to a local directory and returns the public
 * URL served by {@link com.amdevelopers.tms.config.WebConfig} under
 * {@code /uploads/**}.
 */
@Slf4j
@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml");

    private static final Map<String, String> EXTENSION_BY_TYPE = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/gif", ".gif",
            "image/webp", ".webp",
            "image/bmp", ".bmp",
            "image/svg+xml", ".svg");

    private final Path uploadDir;

    public FileStorageService(@Value("${app.upload.dir:./uploads}") String uploadDir) {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new IllegalStateException("Could not create upload directory: " + this.uploadDir, e);
        }
    }

    /**
     * Stores the image using a random file name that never collides, and
     * returns its public URL (e.g. {@code /uploads/3f2a...jpg}).
     */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Only image uploads are allowed");
        }

        String originalName = StringUtils.cleanPath(
                file.getOriginalFilename() == null ? "upload" : file.getOriginalFilename());
        String storedName = UUID.randomUUID() + extensionOf(originalName, contentType);

        Path target = uploadDir.resolve(storedName).normalize();
        if (!target.startsWith(uploadDir)) {
            throw new IllegalArgumentException("Invalid file name");
        }

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store file: " + storedName, e);
        }

        log.info("Stored upload {} ({})", storedName, contentType);
        return "/uploads/" + storedName;
    }

    private String extensionOf(String originalName, String contentType) {
        String extension = StringUtils.getFilenameExtension(originalName);
        if (extension != null) {
            return "." + extension.toLowerCase(Locale.ROOT);
        }
        return EXTENSION_BY_TYPE.getOrDefault(contentType, ".img");
    }
}