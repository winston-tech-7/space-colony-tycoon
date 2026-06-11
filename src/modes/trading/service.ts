import { ListingType } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { publishEvent } from "../../realtime/events.js";
import { speciesById } from "../colony/service.js";

export async function createListing(
  sellerId: bigint,
  creatureId: number,
  priceCredits: number,
  priceStars = 0,
) {
  const creature = await prisma.creature.findFirst({
    where: { id: creatureId, ownerId: sellerId, listed: false },
  });
  if (!creature) throw new Error("Creature not found or already listed");
  if (priceCredits < 1 && priceStars < 1) {
    throw new Error("Set price in credits or stars");
  }

  const listing = await prisma.marketListing.create({
    data: {
      sellerId,
      creatureId,
      priceCredits,
      priceStars,
      listingType: ListingType.fixed,
    },
    include: { creature: true, seller: true },
  });

  await prisma.creature.update({
    where: { id: creatureId },
    data: { listed: true },
  });

  await publishEvent(Number(sellerId), "listing_created", { listingId: listing.id });
  return listing;
}

export async function cancelListing(sellerId: bigint, listingId: number) {
  const listing = await prisma.marketListing.findFirst({
    where: { id: listingId, sellerId, active: true },
  });
  if (!listing) throw new Error("Listing not found");

  await prisma.marketListing.update({
    where: { id: listingId },
    data: { active: false },
  });
  await prisma.creature.update({
    where: { id: listing.creatureId },
    data: { listed: false },
  });

  return listing;
}

export async function buyWithCredits(buyerId: bigint, listingId: number) {
  const listing = await prisma.marketListing.findFirst({
    where: { id: listingId, active: true },
    include: { creature: true },
  });
  if (!listing) throw new Error("Listing not found");
  if (listing.sellerId === buyerId) throw new Error("Cannot buy own listing");
  if (listing.priceCredits < 1) throw new Error("Credits purchase not available");

  const buyer = await prisma.user.findUnique({ where: { telegramId: buyerId } });
  if (!buyer || buyer.credits < listing.priceCredits) {
    throw new Error("Insufficient credits");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { telegramId: buyerId },
      data: { credits: { decrement: listing.priceCredits } },
    }),
    prisma.user.update({
      where: { telegramId: listing.sellerId },
      data: { credits: { increment: listing.priceCredits } },
    }),
    prisma.creature.update({
      where: { id: listing.creatureId },
      data: { ownerId: buyerId, listed: false },
    }),
    prisma.marketListing.update({
      where: { id: listingId },
      data: { active: false },
    }),
    prisma.transaction.create({
      data: {
        buyerId,
        sellerId: listing.sellerId,
        itemType: "creature",
        itemId: listing.creatureId,
        pricePaid: listing.priceCredits,
        currency: "credits",
        listingId,
      },
    }),
  ]);

  await publishEvent(Number(buyerId), "purchase_complete", { listingId });
  return prisma.creature.findUnique({ where: { id: listing.creatureId } });
}

export async function getActiveListings(limit = 20) {
  const listings = await prisma.marketListing.findMany({
    where: { active: true },
    include: { creature: true, seller: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return listings.map((l) => ({
    ...l,
    species: speciesById(l.creature.speciesId),
  }));
}

export async function getUserListings(sellerId: bigint) {
  return prisma.marketListing.findMany({
    where: { sellerId, active: true },
    include: { creature: true },
  });
}

export async function getShareableListings(sellerId: bigint, query: string) {
  const listings = await prisma.marketListing.findMany({
    where: {
      active: true,
      OR: [
        { sellerId },
        { creature: { rarity: { in: ["rare", "legendary"] } } },
      ],
    },
    include: { creature: true, seller: true },
    take: 10,
  });

  const q = query.toLowerCase();
  return listings.filter((l) => {
    if (!q || q.includes("rare") || q.includes("market")) return true;
    return l.creature.name.toLowerCase().includes(q) ||
      l.creature.speciesId.toLowerCase().includes(q);
  });
}
