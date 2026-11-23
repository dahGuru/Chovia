import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../common/errors/api-error.js";
import {
  formatCurrency,
  calculatePlatformFee,
  calculateDeliveryFee,
  BASE_DELIVERY_FEE_MINOR,
} from "../../utils/money.js";
import { googleMapsService } from "../../integrations/google-maps/google-maps.service.js";
import type {
  CalculateEstimateRequestDto,
  EstimateResponseDto,
} from "./dto/pricing.dto.js";

export class PricingService {
  async calculateEstimate(dto: CalculateEstimateRequestDto): Promise<EstimateResponseDto> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: dto.restaurantId },
    });

    if (!restaurant) throw new NotFoundError("Restaurant not found");

    let deliveryLat = dto.latitude;
    let deliveryLng = dto.longitude;

    if (dto.addressId) {
      const address = await prisma.address.findUnique({
        where: { id: dto.addressId },
      });
      if (address) {
        deliveryLat = Number(address.latitude);
        deliveryLng = Number(address.longitude);
      }
    }

    let distanceKm: number | null = null;
    let deliveryFeeMinor = BASE_DELIVERY_FEE_MINOR;

    if (deliveryLat !== undefined && deliveryLng !== undefined) {
      const route = await googleMapsService.calculateRoute(
        { latitude: Number(restaurant.latitude), longitude: Number(restaurant.longitude) },
        { latitude: deliveryLat, longitude: deliveryLng }
      );
      distanceKm = route.distanceKm;
      deliveryFeeMinor = calculateDeliveryFee(distanceKm);
    }

    const itemIds = dto.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
    });

    const itemMap = new Map(menuItems.map((m) => [m.id, m]));

    let subtotalMinor = 0;
    for (const it of dto.items) {
      const menuItem = itemMap.get(it.menuItemId);
      if (!menuItem) {
        throw new NotFoundError(`Menu item ${it.menuItemId} not found`);
      }
      const priceMinor = Math.round(Number(menuItem.price) * 100);
      subtotalMinor += priceMinor * it.quantity;
    }

    const platformFeeMinor = calculatePlatformFee(subtotalMinor);
    const totalMinor = subtotalMinor + deliveryFeeMinor + platformFeeMinor;

    return {
      subtotalMinor,
      subtotalFormatted: formatCurrency(subtotalMinor),
      deliveryFeeMinor,
      deliveryFeeFormatted: formatCurrency(deliveryFeeMinor),
      platformFeeMinor,
      platformFeeFormatted: formatCurrency(platformFeeMinor),
      totalMinor,
      totalFormatted: formatCurrency(totalMinor),
      distanceKm,
    };
  }

  async getActiveConfigs() {
    const [commission, deliveryPricing] = await Promise.all([
      prisma.commissionConfig.findMany({ where: { status: "ACTIVE" } }),
      prisma.deliveryPricingConfig.findMany({ where: { status: "ACTIVE" } }),
    ]);

    return {
      commissions: commission.map((c) => ({
        id: c.id,
        type: c.type,
        amount: Number(c.amount),
        effectiveFrom: c.effectiveFrom.toISOString(),
      })),
      deliveryPricing: deliveryPricing.map((d) => ({
        id: d.id,
        name: d.name,
        baseFee: Number(d.baseFee),
        perKmFee: Number(d.perKmFee),
        minimumFee: Number(d.minimumFee),
        maximumFee: d.maximumFee ? Number(d.maximumFee) : null,
      })),
    };
  }
}

export const pricingService = new PricingService();
