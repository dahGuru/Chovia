import dns from "node:dns/promises";
import net from "node:net";
import { v2 as cloudinary, type UploadApiOptions } from "cloudinary";
import { env } from "../../config/env.js";
import { BadRequestError, NotFoundError, PaymentGatewayError } from "../../common/errors/api-error.js";

export type AllowedFolder = "menu" | "restaurants" | "avatars" | "documents";

export function isPrivateOrBlockedIp(ipStr: string): boolean {
  let ip = ipStr.toLowerCase();

  // Normalize IPv4-mapped IPv6 addresses: ::ffff:192.0.2.1 -> 192.0.2.1
  if (ip.startsWith("::ffff:")) {
    const candidate = ip.slice(7);
    if (net.isIPv4(candidate)) {
      ip = candidate;
    }
  }

  const ipVersion = net.isIP(ip);
  if (ipVersion === 0) {
    return true; // Not a valid IP
  }

  if (ipVersion === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4) return true;
    const [b0, b1, b2, b3] = parts;
    if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) return true;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;

    // 10.0.0.0/8 (Private)
    if (b0 === 10) return true;

    // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

    // 192.168.0.0/16 (Private)
    if (b0 === 192 && b1 === 168) return true;

    // 169.254.0.0/16 (Link-local / Cloud metadata: 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;

    // 100.64.0.0/10 (Carrier-grade NAT: 100.64.0.0 - 100.127.255.255)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

    // Documentation / TEST-NET: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
    if (b0 === 192 && b1 === 0 && b2 === 2) return true;
    if (b0 === 198 && b1 === 51 && b2 === 100) return true;
    if (b0 === 203 && b1 === 0 && b2 === 113) return true;

    // Broadcast & Reserved (224.0.0.0/4 multicast, 240.0.0.0/4 reserved, 255.255.255.255)
    if (b0 >= 224) return true;

    return false;
  }

  if (ipVersion === 6) {
    // Loopback ::1
    if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;

    // Unspecified ::
    if (ip === "::" || ip === "0:0:0:0:0:0:0:0") return true;

    // Link-local: fe80::/10 (fe80 to febf)
    if (/^fe[89ab][0-9a-f]:/i.test(ip) || ip.startsWith("fe80:")) return true;

    // Unique Local Address (ULA): fc00::/7 (fc00 to fdff)
    if (/^f[cd][0-9a-f]{2}:/i.test(ip) || ip.startsWith("fc") || ip.startsWith("fd")) return true;

    return false;
  }

  return true;
}

export interface UploadPolicy {
  folder: AllowedFolder;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedFormats: string[];
  resourceType: "image" | "auto" | "raw";
  deliveryType: "upload" | "authenticated";
}

export const UPLOAD_POLICIES: Record<AllowedFolder, UploadPolicy> = {
  avatars: {
    folder: "avatars",
    maxSizeBytes: 5 * 1024 * 1024, // 5MB (accommodates high-res profile photos)
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    resourceType: "image",
    deliveryType: "upload",
  },
  menu: {
    folder: "menu",
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    resourceType: "image",
    deliveryType: "upload",
  },
  restaurants: {
    folder: "restaurants",
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    resourceType: "image",
    deliveryType: "upload",
  },
  documents: {
    folder: "documents",
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    allowedFormats: ["jpg", "jpeg", "png", "pdf"],
    resourceType: "auto",
    deliveryType: "authenticated",
  },
};

export interface UploadSignatureResult {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  allowedFormats: string[];
  maxFileSize: number;
  resourceType: string;
  deliveryType: "upload" | "authenticated";
  publicId?: string | undefined;
}

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  deliveryType?: "upload" | "authenticated" | undefined;
  width?: number | undefined;
  height?: number | undefined;
  format?: string | undefined;
  bytes?: number | undefined;
  resourceType?: string | undefined;
}

export function inspectFileMagicBytes(buffer: Buffer): { format: string; mimeType: string } | null {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { format: "jpg", mimeType: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { format: "png", mimeType: "image/png" };
  }

  // WEBP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { format: "webp", mimeType: "image/webp" };
  }

  // PDF: %PDF
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { format: "pdf", mimeType: "application/pdf" };
  }

  return null;
}

const ALLOWED_FOLDERS: readonly AllowedFolder[] = [
  "menu",
  "restaurants",
  "avatars",
  "documents",
] as const;

export class CloudinaryService {
  private isConfigured: boolean;
  private isMock: boolean;

  constructor() {
    this.isConfigured = Boolean(
      env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET
    );
    const isStrict = env.NODE_ENV === "production" || env.NODE_ENV === "staging";
    if (isStrict) {
      if (!this.isConfigured) {
        throw new Error(
          `Cloudinary credentials are missing in ${env.NODE_ENV}. Mock mode is forbidden.`
        );
      }
      this.isMock = false;
    } else {
      this.isMock =
        Boolean(env.MOCK_INTEGRATIONS) ||
        !this.isConfigured ||
        env.NODE_ENV === "test" ||
        env.CLOUDINARY_API_KEY.startsWith("mock_") ||
        env.CLOUDINARY_CLOUD_NAME.includes("mock");
    }

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
  }

  validateUploadMetadata(folder: string, mimeType?: string, fileSizeBytes?: number): void {
    const policy = UPLOAD_POLICIES[folder as AllowedFolder];
    if (!policy) {
      throw new BadRequestError(
        `Invalid upload folder "${folder}". Allowed folders: ${ALLOWED_FOLDERS.join(", ")}`
      );
    }

    if (mimeType && !policy.allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new BadRequestError(
        `Invalid file type "${mimeType}". Allowed types for ${folder}: ${policy.allowedMimeTypes.join(", ")}`
      );
    }

    if (fileSizeBytes !== undefined && fileSizeBytes > policy.maxSizeBytes) {
      throw new BadRequestError(
        `File exceeds maximum permitted size of ${policy.maxSizeBytes / (1024 * 1024)}MB for ${folder}`
      );
    }
  }

  generateUploadSignature(
    folder: AllowedFolder,
    customPublicId?: string,
    tags?: string[]
  ): UploadSignatureResult {
    const policy = UPLOAD_POLICIES[folder];
    if (!policy) {
      throw new BadRequestError(
        `Invalid upload folder "${folder}". Allowed folders: ${ALLOWED_FOLDERS.join(", ")}`
      );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const allowedFormatsStr = policy.allowedFormats.join(",");

    // Include security-sensitive provider-level restrictions in the signed parameters
    const paramsToSign: Record<string, unknown> = {
      allowed_formats: allowedFormatsStr,
      folder: `chovia/${folder}`,
      timestamp,
    };

    if (policy.deliveryType === "authenticated") {
      paramsToSign["type"] = "authenticated";
    }
    if (customPublicId) {
      paramsToSign["public_id"] = customPublicId;
    }
    if (tags && tags.length > 0) {
      paramsToSign["tags"] = tags.join(",");
    }

    if (this.isMock) {
      return {
        signature: `mock_signature_${timestamp}`,
        timestamp,
        cloudName: env.CLOUDINARY_CLOUD_NAME || "chovia-mock",
        apiKey: env.CLOUDINARY_API_KEY || "mock_api_key",
        folder: `chovia/${folder}`,
        allowedFormats: policy.allowedFormats,
        maxFileSize: policy.maxSizeBytes,
        resourceType: policy.resourceType,
        deliveryType: policy.deliveryType,
        ...(customPublicId ? { publicId: customPublicId } : {}),
      };
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign as Record<string, string | number>,
      env.CLOUDINARY_API_SECRET
    );

    return {
      signature,
      timestamp,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      folder: `chovia/${folder}`,
      allowedFormats: policy.allowedFormats,
      maxFileSize: policy.maxSizeBytes,
      resourceType: policy.resourceType,
      deliveryType: policy.deliveryType,
      ...(customPublicId ? { publicId: customPublicId } : {}),
    };
  }

  async validateRemoteUrl(urlStr: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      throw new BadRequestError("Invalid remote image URL");
    }

    if (url.protocol !== "https:") {
      throw new BadRequestError("Remote upload URLs must use HTTPS");
    }

    const hostname = url.hostname.toLowerCase();
    // Protect against SSRF: block private ranges, localhost, and cloud metadata endpoints
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "169.254.169.254" ||
      hostname === "metadata.google.internal" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost") ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      throw new BadRequestError("Remote upload URLs targeting internal, loopback, or metadata services are forbidden");
    }

    if (net.isIP(hostname)) {
      if (isPrivateOrBlockedIp(hostname)) {
        throw new BadRequestError("Remote upload URLs targeting internal, loopback, or metadata services are forbidden");
      }
    } else {
      try {
        const addresses = await dns.lookup(hostname, { all: true });
        if (!addresses || addresses.length === 0) {
          throw new BadRequestError("Remote upload URL domain could not be resolved");
        }

        for (const entry of addresses) {
          if (isPrivateOrBlockedIp(entry.address)) {
            throw new BadRequestError(
              `Remote upload URLs resolving to internal or private addresses (${entry.address}) are forbidden`
            );
          }
        }
      } catch (err: unknown) {
        if (err instanceof BadRequestError) throw err;
        throw new BadRequestError(
          `Unable to resolve remote image host "${hostname}": ${err instanceof Error ? err.message : "DNS resolution failure"}`
        );
      }
    }
  }

  generateSignedAssetUrl(
    publicId: string,
    resourceType: string = "image",
    format?: string,
    expiresInSeconds = 600
  ): string {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const resolvedResourceType = resourceType === "auto" ? "image" : resourceType;

    if (this.isMock) {
      return `https://api.cloudinary.com/v1_1/chovia-mock/${resolvedResourceType}/download?public_id=${encodeURIComponent(publicId)}&type=authenticated&expires_at=${expiresAt}&signature=mock_signed_${expiresAt}`;
    }

    return cloudinary.utils.private_download_url(publicId, format || "", {
      resource_type: resolvedResourceType,
      type: "authenticated",
      expires_at: expiresAt,
    });
  }

  async verifyAssetWithProvider(
    publicId: string,
    folder: AllowedFolder,
    expectedUserId?: string
  ): Promise<CloudinaryUploadResult> {
    const policy = UPLOAD_POLICIES[folder];
    if (!policy) {
      throw new BadRequestError(`Invalid upload category "${folder}".`);
    }

    const expectedPrefix = `chovia/${folder}/`;
    if (!publicId.startsWith(expectedPrefix)) {
      throw new BadRequestError(
        `Upload publicId "${publicId}" does not belong to expected folder "${expectedPrefix}".`
      );
    }

    // Prevent cross-user asset claims for user-scoped resources (avatars & KYC documents) using exact segment matching
    if ((folder === "avatars" || folder === "documents") && expectedUserId) {
      const relativePath = publicId.slice(expectedPrefix.length);
      const segments = relativePath.split("/");
      const filename = segments[segments.length - 1] ?? "";
      const isOwner =
        segments[0] === expectedUserId ||
        filename.startsWith(`${expectedUserId}_`) ||
        filename === expectedUserId;

      if (!isOwner) {
        throw new BadRequestError(
          `Unauthorized asset claim: publicId "${publicId}" does not belong to authenticated user.`
        );
      }
    }

    if (this.isMock) {
      const mockResourceType = policy.resourceType === "auto" ? "image" : policy.resourceType;
      const mockFormat = policy.allowedFormats.includes("webp")
        ? "webp"
        : (policy.allowedFormats[0] ?? "png");
      const mockResult: CloudinaryUploadResult = {
        publicId,
        secureUrl:
          policy.deliveryType === "authenticated"
            ? this.generateSignedAssetUrl(publicId, mockResourceType, mockFormat)
            : `https://res.cloudinary.com/chovia/${policy.resourceType}/upload/v1/${publicId}.${mockFormat}`,
        deliveryType: policy.deliveryType,
        format: mockFormat,
        bytes: 102400,
        resourceType: mockResourceType,
        width: 800,
        height: 600,
      };
      this.verifyUploadResponse(folder, mockResult);
      return mockResult;
    }

    let resource: Record<string, unknown> | undefined;
    const candidateResourceTypes =
      policy.resourceType === "auto" ? ["image", "raw"] : [policy.resourceType];

    for (const candidateType of candidateResourceTypes) {
      try {
        resource = (await cloudinary.api.resource(publicId, {
          resource_type: candidateType,
          type: policy.deliveryType,
        })) as Record<string, unknown>;
        break;
      } catch (err: unknown) {
        const errorObj = err as { http_code?: number; error?: { http_code?: number } };
        const statusCode = errorObj.http_code || errorObj.error?.http_code;
        if (statusCode === 404) {
          continue;
        }
        const message = err instanceof Error ? err.message : "Cloudinary asset lookup failed";
        throw new PaymentGatewayError(`Cloudinary asset verification error: ${message}`);
      }
    }

    if (!resource) {
      throw new NotFoundError(`Asset "${publicId}" does not exist on Cloudinary.`);
    }

    const actualType = typeof resource["type"] === "string" ? resource["type"] : "upload";
    if (policy.deliveryType === "authenticated" && actualType !== "authenticated") {
      throw new BadRequestError(
        `Asset "${publicId}" must use authenticated private delivery storage.`
      );
    }

    const actualBytes = Number(resource["bytes"]);
    const actualFormat =
      typeof resource["format"] === "string" ? resource["format"].toLowerCase() : undefined;
    const actualResourceType =
      typeof resource["resource_type"] === "string" ? resource["resource_type"] : undefined;

    // Verify actual byte size and format from provider metadata (never trust client claims)
    this.verifyUploadResponse(folder, {
      publicId,
      format: actualFormat,
      bytes: Number.isFinite(actualBytes) ? actualBytes : undefined,
      resourceType: actualResourceType,
    });

    const verifiedPublicId = String(resource["public_id"]);
    const secureUrl =
      policy.deliveryType === "authenticated"
        ? this.generateSignedAssetUrl(verifiedPublicId, actualResourceType || "image", actualFormat)
        : String(resource["secure_url"]);

    return {
      publicId: verifiedPublicId,
      secureUrl,
      deliveryType: policy.deliveryType,
      format: actualFormat,
      bytes: actualBytes,
      resourceType: actualResourceType,
      width: typeof resource["width"] === "number" ? resource["width"] : undefined,
      height: typeof resource["height"] === "number" ? resource["height"] : undefined,
    };
  }

  verifyUploadResponse(
    folder: AllowedFolder,
    response: {
      publicId: string;
      format?: string | undefined;
      bytes?: number | undefined;
      resourceType?: string | undefined;
    }
  ): void {
    const policy = UPLOAD_POLICIES[folder];
    if (!policy) {
      throw new BadRequestError(`Invalid upload category "${folder}".`);
    }

    if (!response.publicId.startsWith(`chovia/${folder}/`)) {
      throw new BadRequestError(
        `Upload publicId does not belong to expected folder "chovia/${folder}". Received: ${response.publicId}`
      );
    }

    if (response.format && !policy.allowedFormats.includes(response.format.toLowerCase())) {
      throw new BadRequestError(
        `Upload format "${response.format}" is not permitted for category "${folder}". Permitted: ${policy.allowedFormats.join(", ")}`
      );
    }

    if (response.bytes && response.bytes > policy.maxSizeBytes) {
      throw new BadRequestError(
        `Upload size (${response.bytes} bytes) exceeds limit of ${policy.maxSizeBytes} bytes for category "${folder}".`
      );
    }
  }

  async uploadImage(
    fileInput: string,
    folder: AllowedFolder,
    publicId?: string
  ): Promise<CloudinaryUploadResult> {
    const policy = UPLOAD_POLICIES[folder];
    if (!policy) {
      throw new BadRequestError(`Invalid upload folder "${folder}".`);
    }

    let detectedFormat: string | undefined;

    // Inspect actual byte payload for base64 uploads
    if (fileInput.startsWith("data:") || !fileInput.startsWith("http")) {
      const base64Data = fileInput.includes(",") ? fileInput.split(",")[1] : fileInput;
      if (base64Data) {
        const buffer = Buffer.from(base64Data, "base64");

        if (buffer.length > policy.maxSizeBytes) {
          throw new BadRequestError(
            `File exceeds maximum permitted size of ${policy.maxSizeBytes / (1024 * 1024)}MB for ${folder}`
          );
        }

        const detected = inspectFileMagicBytes(buffer);
        if (!detected) {
          throw new BadRequestError(
            `Unable to verify file signature. File is corrupted or unpermitted format for ${folder}.`
          );
        }

        if (!policy.allowedFormats.includes(detected.format)) {
          throw new BadRequestError(
            `File format "${detected.format}" is not allowed for category "${folder}". Allowed: ${policy.allowedFormats.join(", ")}`
          );
        }

        detectedFormat = detected.format;
      }
    } else {
      // Validate remote URL against SSRF and require HTTPS
      await this.validateRemoteUrl(fileInput);
    }

    if (this.isMock) {
      const generatedId = publicId || `mock_${Date.now()}`;
      const resolvedPublicId = `chovia/${folder}/${generatedId}`;
      const fallbackFormat = policy.allowedFormats.includes("webp")
        ? "webp"
        : (policy.allowedFormats[0] ?? "png");
      const resolvedFormat = detectedFormat || fallbackFormat;
      const resolvedResourceType =
        resolvedFormat === "pdf"
          ? "raw"
          : policy.resourceType === "auto"
            ? "image"
            : policy.resourceType;
      const mockResult: CloudinaryUploadResult = {
        publicId: resolvedPublicId,
        secureUrl:
          policy.deliveryType === "authenticated"
            ? this.generateSignedAssetUrl(resolvedPublicId, resolvedResourceType, resolvedFormat)
            : `https://res.cloudinary.com/chovia/${policy.resourceType}/upload/v1/${resolvedPublicId}.${resolvedFormat}`,
        deliveryType: policy.deliveryType,
        format: resolvedFormat,
        width: resolvedResourceType === "image" ? 800 : undefined,
        height: resolvedResourceType === "image" ? 600 : undefined,
        bytes: 102400,
        resourceType: resolvedResourceType,
      };
      this.verifyUploadResponse(folder, mockResult);
      return mockResult;
    }

    try {
      const uploadOptions: UploadApiOptions = {
        folder: `chovia/${folder}`,
        resource_type: policy.resourceType,
        type: policy.deliveryType,
        allowed_formats: policy.allowedFormats,
        overwrite: false,
      };
      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      const result = await cloudinary.uploader.upload(fileInput, uploadOptions);

      const uploadResult: CloudinaryUploadResult = {
        publicId: result.public_id,
        secureUrl:
          policy.deliveryType === "authenticated"
            ? this.generateSignedAssetUrl(result.public_id, result.resource_type, result.format)
            : result.secure_url,
        deliveryType: policy.deliveryType,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        resourceType: result.resource_type,
      };

      this.verifyUploadResponse(folder, uploadResult);
      return uploadResult;
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      const message = error instanceof Error ? error.message : "Cloudinary upload failed";
      throw new BadRequestError(`Media upload failed: ${message}`);
    }
  }

  async deleteImage(
    publicId: string,
    options?: {
      resourceType?: "image" | "raw";
      deliveryType?: "upload" | "authenticated";
    }
  ): Promise<{ result: string }> {
    if (this.isMock) {
      return { result: "ok" };
    }

    try {
      const response = (await cloudinary.uploader.destroy(publicId, {
        resource_type: options?.resourceType ?? "image",
        type: options?.deliveryType ?? "upload",
      })) as { result: string };
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloudinary delete failed";
      throw new BadRequestError(`Media deletion failed: ${message}`);
    }
  }
}

export const cloudinaryService = new CloudinaryService();
